// @vitest-environment jsdom
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import SelectionToolbar from "../src/components/SelectionToolbar"

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act
let root: Root
let props: React.ComponentProps<typeof SelectionToolbar>
const writeText = vi.fn()
const button = (label: string) =>
    document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
const render = async () => {
    await act(async () => root.render(<SelectionToolbar {...props} />))
}

beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    document.body.innerHTML = "<div id=host></div>"
    root = createRoot(document.querySelector("#host")!)
    writeText.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText }
    })
    props = {
        result: {
            mode: "explain",
            value: "## 引力\n\n物体之间的吸引作用。",
            loading: false
        },
        active: true,
        pinned: false,
        onTogglePinned: vi.fn(),
        onClose: vi.fn()
    }
})
afterEach(async () => {
    await act(async () => root.unmount())
    vi.useRealTimers()
})

describe("selection toolbar", () => {
    it.each(["explain", "translate"] as const)(
        "copies the complete %s result and clears success feedback",
        async mode => {
            props.result = { ...props.result, mode }
            vi.useFakeTimers()
            await render()
            await act(async () => button("复制结果").click())
            expect(writeText).toHaveBeenCalledWith(props.result.value)
            expect(button("已复制").title).toBe("已复制")
            expect(document.querySelector('[role="status"]')?.textContent).toBe(
                "已复制"
            )
            await act(async () => vi.advanceTimersByTimeAsync(2000))
            expect(button("复制结果")).not.toBeNull()
        }
    )
    it.each(["loading", "empty", "error", "hidden"])(
        "disables copying when %s",
        async condition => {
            if (condition === "loading")
                props.result = { ...props.result, loading: true }
            if (condition === "empty")
                props.result = { ...props.result, value: "" }
            if (condition === "error")
                props.result = { ...props.result, error: "失败" }
            if (condition === "hidden") props.active = false
            await render()
            expect(button("复制结果").disabled).toBe(true)
            await act(async () => button("复制结果").click())
            expect(writeText).not.toHaveBeenCalled()
        }
    )
    it("exposes pin state and invokes pin and close actions", async () => {
        await render()
        expect(button("固定面板").getAttribute("aria-pressed")).toBe("false")
        await act(async () => button("固定面板").click())
        expect(props.onTogglePinned).toHaveBeenCalledOnce()
        props.pinned = true
        await render()
        expect(button("取消固定").getAttribute("aria-pressed")).toBe("true")
        await act(async () => button("关闭划词面板").click())
        expect(props.onClose).toHaveBeenCalledOnce()
    })
    it("shows a safe copy failure hint", async () => {
        writeText.mockRejectedValueOnce(new Error("permission denied"))
        await render()
        await act(async () => button("复制结果").click())
        expect(document.querySelector('[role="status"]')?.textContent).toBe(
            "复制失败，请选中内容手动复制"
        )
        expect(document.body.textContent).not.toContain("permission denied")
    })
    it.each(["result", "hidden"])(
        "ignores a pending clipboard result after %s changes",
        async change => {
            let resolve!: () => void
            writeText.mockReturnValueOnce(
                new Promise<void>(done => {
                    resolve = done
                })
            )
            await render()
            await act(async () => button("复制结果").click())
            if (change === "result")
                props.result = { ...props.result, value: "新结果" }
            else props.active = false
            await render()
            await act(async () => resolve())
            expect(button("已复制")).toBeNull()
            expect(document.querySelector('[role="status"]')).toBeNull()
        }
    )
})
