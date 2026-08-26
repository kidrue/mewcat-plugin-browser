import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import React from "react"
import { createRoot } from "react-dom/client"

import { defaultExtensionConfig } from "../src/state/constants"

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

const dom = new JSDOM(
    "<!doctype html><html><body><p id=source>Selection translation works</p><button id=outside>Outside</button><div id=host></div></body></html>",
    { url: "https://example.com/article" }
)

Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    MouseEvent: { configurable: true, value: dom.window.MouseEvent },
    Event: { configurable: true, value: dom.window.Event },
    EventTarget: { configurable: true, value: dom.window.EventTarget },
    Node: { configurable: true, value: dom.window.Node }
})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const { useSelectionTranslate } = await import(
    "../src/hooks/useSelectionTranslate"
)

let latestHook: ReturnType<typeof useSelectionTranslate<HTMLDivElement>>

function Harness({
    configOverrides = {}
}: {
    configOverrides?: Partial<typeof defaultExtensionConfig>
}) {
    const hook = useSelectionTranslate<HTMLDivElement>({
        config: {
            ...defaultExtensionConfig,
            isSelectedTranslate: true,
            selectionTriggerMode: "direct",
            ...configOverrides
        }
    })
    latestHook = hook

    return (
        <div>
            <div data-testid="dot" ref={hook.dotRef} />
            <div data-testid="panel" ref={hook.containerRef} />
        </div>
    )
}

const shadowHost = document.querySelector<HTMLDivElement>("#host")
assert.ok(shadowHost)
const shadowRoot = shadowHost.attachShadow({ mode: "open" })
const rootElement = document.createElement("div")
shadowRoot.appendChild(rootElement)
const root = createRoot(rootElement)

await act(async () => {
    root.render(<Harness configOverrides={{ selectionTriggerMode: "shift" }} />)
})

const source = document.querySelector<HTMLElement>("#source")
const outside = document.querySelector<HTMLElement>("#outside")
assert.ok(source?.firstChild)
assert.ok(outside)
const sourceTextNode = source.firstChild

function setPageSelection(startOffset: number, endOffset: number) {
    const range = document.createRange()
    range.setStart(sourceTextNode, startOffset)
    range.setEnd(sourceTextNode, endOffset)
    const width = Math.max(40, (endOffset - startOffset) * 8)
    Object.assign(range, {
        getBoundingClientRect: () => ({
            top: 40,
            left: 80,
            width,
            height: 20,
            right: 80 + width,
            bottom: 60,
            x: 80,
            y: 40,
            toJSON: () => ({})
        })
    })
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
}

async function dragSelect(startOffset: number, endOffset: number) {
    await act(async () => {
        source.dispatchEvent(
            new window.MouseEvent("mousedown", {
                bubbles: true,
                composed: true,
                clientX: 80,
                clientY: 40
            })
        )
        setPageSelection(startOffset, endOffset)
        source.dispatchEvent(
            new window.MouseEvent("mouseup", {
                bubbles: true,
                composed: true,
                clientX: 80 + (endOffset - startOffset) * 8,
                clientY: 60
            })
        )
    })
}

await act(async () => {
    document.dispatchEvent(
        new window.KeyboardEvent("keyup", { key: "Shift", bubbles: true })
    )
})
assert.equal(
    latestHook!.state.isVisible,
    false,
    "Modifier keys without captured text must not open panel state"
)

await act(async () => {
    root.render(<Harness />)
})

await dragSelect(0, sourceTextNode.textContent?.length ?? 0)

assert.equal(latestHook!.state.isVisible, true)
assert.equal(latestHook!.state.text, "Selection translation works")

const panel = shadowRoot.querySelector<HTMLElement>("[data-testid=panel]")
assert.ok(panel)
await act(async () => {
    panel.dispatchEvent(
        new window.MouseEvent("mousedown", { bubbles: true, composed: true })
    )
    panel.dispatchEvent(
        new window.MouseEvent("mouseup", { bubbles: true, composed: true })
    )
})
assert.equal(
    latestHook!.state.isVisible,
    true,
    "Clicks composed through the Shadow DOM panel must not close it"
)

await act(async () => {
    outside.dispatchEvent(
        new window.MouseEvent("mousedown", { bubbles: true, composed: true })
    )
})

assert.deepEqual(
    latestHook!.state.position,
    { top: 0, left: 0 },
    "Closing the panel must reset its calculated position"
)

await act(async () => {
    outside.dispatchEvent(
        new window.MouseEvent("mouseup", { bubbles: true, composed: true })
    )
})

assert.equal(
    latestHook!.state.isVisible,
    false,
    "An external click must close the panel without reopening it on mouseup"
)
assert.equal(
    window.getSelection()?.toString(),
    "Selection translation works",
    "Closing the panel must preserve the page's native selection"
)

await act(async () => {
    root.render(
        <Harness
            configOverrides={{
                selectionTriggerMode: "dot",
                selectionDisabledSites: ["example.com"]
            }}
        />
    )
})

await dragSelect(0, 9)

assert.equal(
    latestHook!.state.isDotVisible,
    false,
    "Dot mode must stay disabled on configured sites"
)

await act(async () => {
    root.render(<Harness configOverrides={{ selectionTriggerMode: "dot" }} />)
})
await dragSelect(10, 21)
assert.equal(latestHook!.state.text, "translation")
assert.equal(latestHook!.state.isDotVisible, true)
assert.equal(latestHook!.state.isVisible, false)

const dot = shadowRoot.querySelector<HTMLElement>("[data-testid=dot]")
assert.ok(dot)
await act(async () => {
    dot.dispatchEvent(
        new window.MouseEvent("mousedown", { bubbles: true, composed: true })
    )
    dot.dispatchEvent(
        new window.MouseEvent("mouseup", { bubbles: true, composed: true })
    )
})
assert.equal(
    latestHook!.state.isDotVisible,
    true,
    "Clicks composed through the Shadow DOM dot must stay internal"
)

await act(async () => {
    root.render(<Harness />)
})
assert.equal(
    latestHook!.state.isDotVisible,
    false,
    "Changing away from dot mode must remove a stale trigger dot"
)

await act(async () => {
    root.render(<Harness configOverrides={{ selectionTriggerMode: "dot" }} />)
})
await dragSelect(22, 27)
assert.equal(latestHook!.state.isDotVisible, true)
await act(async () => {
    latestHook!.actions.onDotClick()
})
assert.equal(latestHook!.state.isVisible, true)
assert.equal(latestHook!.state.isDotVisible, false)

await act(async () => {
    root.render(
        <Harness
            configOverrides={{
                selectionTriggerMode: "dot",
                selectionInteractionMode: "hover"
            }}
        />
    )
})
await dragSelect(0, 9)
assert.equal(latestHook!.state.text, "Selection")
assert.equal(latestHook!.state.isDotVisible, true)
await act(async () => {
    latestHook!.actions.onDotHover()
})
assert.equal(latestHook!.state.isVisible, true)

await act(async () => {
    root.render(<Harness configOverrides={{ selectionTriggerMode: "shift" }} />)
})
await dragSelect(10, 21)
assert.equal(latestHook!.state.isVisible, false)
assert.equal(latestHook!.state.isDotVisible, false)
await act(async () => {
    document.dispatchEvent(
        new window.KeyboardEvent("keyup", { key: "Shift", bubbles: true })
    )
})
assert.equal(latestHook!.state.isVisible, true)

await act(async () => {
    root.render(<Harness configOverrides={{ selectionTriggerMode: "ctrl" }} />)
})
await dragSelect(22, 27)
assert.equal(latestHook!.state.isVisible, false)
await act(async () => {
    document.dispatchEvent(
        new window.KeyboardEvent("keyup", { key: "Control", bubbles: true })
    )
})
assert.equal(latestHook!.state.isVisible, true)

await act(async () => {
    root.unmount()
})
dom.window.close()

console.log("Selection translation hook interaction tests passed")
