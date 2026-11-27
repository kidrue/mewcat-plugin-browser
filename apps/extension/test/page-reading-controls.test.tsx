// @vitest-environment jsdom
import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { afterEach, expect, it, vi } from "vitest"

import PageReadingControls from "../src/components/PageReadingControls"
import type {
    PageActionExecutor,
    ReadingState
} from "../src/features/reading/pageActions"

let root: ReturnType<typeof createRoot>
afterEach(async () => {
    await act(async () => root?.unmount())
})
async function render(execute: PageActionExecutor) {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    document.body.innerHTML = "<div id='host'></div>"
    root = createRoot(document.getElementById("host")!)
    await act(async () =>
        root.render(<PageReadingControls execute={execute} />)
    )
}
it("starts and clears the current page and offers retry for partial failures", async () => {
    let state: ReadingState = { status: "idle", translated: 0, failed: 0 }
    const execute = vi
        .fn<PageActionExecutor>()
        .mockImplementation(async request => {
            if (request.action === "start")
                state = { status: "partial", translated: 2, failed: 1 }
            if (request.action === "retry")
                state = { status: "complete", translated: 3, failed: 0 }
            if (request.action === "clear")
                state = { status: "idle", translated: 0, failed: 0 }
            return state
        })
    const find = (text: string) =>
        [...document.querySelectorAll("button")].find(
            button => button.textContent === text
        )!
    await render(execute)
    await act(async () => find("翻译当前页").click())
    expect(document.body.textContent).toContain("失败 1 段")
    await act(async () => find("重试失败内容").click())
    expect(document.body.textContent).toContain("当前阅读区域已处理")
    await act(async () => find("显示原文").click())
    expect(document.body.textContent).toContain("尚未翻译")
    expect(execute.mock.calls.map(([request]) => request.action)).toEqual([
        "status",
        "start",
        "retry",
        "clear"
    ])
})
it("disables translation on unsupported pages and displays the reason", async () => {
    await render(async () => ({
        status: "unavailable",
        translated: 0,
        failed: 0,
        reason: "浏览器内部页不支持翻译"
    }))
    expect(document.querySelector("button")?.disabled).toBe(true)
    expect(document.body.textContent).toContain("浏览器内部页不支持翻译")
})

it("enables controls for a new page while discarding the previous page's pending action", async () => {
    const idle: ReadingState = { status: "idle", translated: 0, failed: 0 }
    let finish!: (state: ReadingState) => void
    const request = new Promise<ReadingState>(resolve => {
        finish = resolve
    })
    await render(async ({ action }) => (action === "start" ? request : idle))
    const translate = () => document.querySelector("button")!

    await act(async () => translate().click())
    expect(translate().disabled).toBe(true)

    const execute: PageActionExecutor = async () => idle
    await act(async () =>
        root.render(<PageReadingControls execute={execute} />)
    )
    expect(translate().disabled).toBe(false)

    await act(async () =>
        finish({ status: "complete", translated: 4, failed: 0 })
    )
    expect(document.body.textContent).toContain("尚未翻译")
    expect(translate().disabled).toBe(false)
})
