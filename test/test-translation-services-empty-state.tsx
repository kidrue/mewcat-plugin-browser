import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import React from "react"
import { createRoot } from "react-dom/client"

import { AI_TRANSLATION_SERVICES } from "../src/constants/translationServices"
import { AddModel } from "../src/components/AddModel"

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

const dom = new JSDOM("<!doctype html><html><body><div id=host></div></body></html>", {
    url: "https://example.com/options"
})

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

const host = document.querySelector<HTMLDivElement>("#host")
assert.ok(host)
const root = createRoot(host)

await act(async () => {
    root.render(
        <>
            <AddModel onItemClick={() => undefined} />
            <AddModel label="添加 AI 模型" onItemClick={() => undefined} />
        </>
    )
})

function getByRole(role: string, name: string) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(role))
    const matching = elements.filter(element => element.textContent === name)
    assert.equal(matching.length, 1, `Expected one ${role} named ${name}`)
    return matching[0]
}

assert.equal(getByRole("button", "添加模型").textContent, "添加模型")
const customTrigger = getByRole("button", "添加 AI 模型")
assert.equal(customTrigger.textContent, "添加 AI 模型")

await act(async () => {
    customTrigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
})

for (const service of AI_TRANSLATION_SERVICES) {
    assert.ok(document.body.textContent?.includes(service.name), service.name)
}

console.log("translation-services-empty-state: PASS")
