// @vitest-environment jsdom
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"

import Select from "../src/components/Select"

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const options = [
    { value: "en", label: "英语" },
    { value: "zh-CN", label: "简体中文" },
    { value: "ja", label: "日语" }
]

afterEach(async () => {
    await act(async () => root?.unmount())
    document.body.replaceChildren()
})

async function render(
    props: Partial<React.ComponentProps<typeof Select>> = {}
) {
    const host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
    await act(async () =>
        root.render(
            <Select
                options={options}
                value="en"
                onChange={() => undefined}
                {...props}
            />
        )
    )
    const trigger = host.querySelector("button")!
    await act(async () => trigger.click())
    return trigger
}

async function search(value: string) {
    const input = document.querySelector<HTMLInputElement>(
        'input[type="search"]'
    )!
    expect(input).not.toBeNull()
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
        )!.set!.call(input, value)
        input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    return input
}

it("filters labels and values without changing selection and resets after closing", async () => {
    const onChange = vi.fn()
    const trigger = await render({ onChange })
    await search(" ZH-cn ")
    expect(
        [...document.querySelectorAll('[role="option"]')].map(
            el => el.textContent
        )
    ).toEqual(["简体中文"])
    expect(trigger.textContent).toContain("英语")
    expect(onChange).not.toHaveBeenCalled()
    await search("日语")
    await act(async () =>
        document.querySelector<HTMLButtonElement>('[role="option"]')!.click()
    )
    expect(onChange).toHaveBeenCalledWith("ja")
    expect(document.querySelector('input[type="search"]')).toBeNull()
    await act(async () => trigger.click())
    expect(
        document.querySelector<HTMLInputElement>('input[type="search"]')!.value
    ).toBe("")
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(3)
})

it("keeps search usable with no matches and supports keyboard focus and Escape", async () => {
    const trigger = await render()
    const input = await search("missing")
    expect(document.querySelector('[role="status"]')).not.toBeNull()
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(0)
    await search("")
    await act(async () =>
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
        )
    )
    expect(document.activeElement?.textContent).toBe("英语")
    await act(async () =>
        document.activeElement!.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        )
    )
    expect(document.querySelector('input[type="search"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
})

it("preserves hidden selections when selecting filtered multi-select options", async () => {
    const onChange = vi.fn()
    await render({ multiple: true, value: ["en"], onChange })
    await search("中文")
    await act(async () =>
        document.querySelector<HTMLButtonElement>('[role="option"]')!.click()
    )
    expect(onChange).toHaveBeenCalledWith(["en", "zh-CN"])
    expect(document.querySelector('input[type="search"]')).not.toBeNull()
})

it("does not open a disabled select", async () => {
    const trigger = await render({ disabled: true })
    expect(trigger.disabled).toBe(true)
    expect(document.querySelector('input[type="search"]')).toBeNull()
})

it("focuses search on opening and clears it after an outside click", async () => {
    const trigger = await render({ withinPortal: true })
    const input = await search("中文")
    expect(document.activeElement).toBe(input)
    await act(async () => {
        document.body.dispatchEvent(
            new MouseEvent("pointerdown", { bubbles: true })
        )
    })
    expect(document.querySelector('input[type="search"]')).toBeNull()
    await act(async () => trigger.click())
    expect(
        document.querySelector<HTMLInputElement>('input[type="search"]')!.value
    ).toBe("")
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(3)
})
