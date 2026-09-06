// @vitest-environment jsdom

import { JSDOM } from "jsdom"
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    clear: vi.fn(),
    read: vi.fn()
}))

vi.mock("../src/token-usage/storage.ts", () => ({
    clearTokenUsage: mocks.clear,
    readTokenUsage: mocks.read
}))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

describe("token usage options page", () => {
    let container: HTMLDivElement
    let root: Root

    beforeEach(() => {
        const dom = new JSDOM("<!doctype html><html><body></body></html>", {
            url: "https://extension.test"
        })
        vi.stubGlobal("window", dom.window)
        vi.stubGlobal("document", dom.window.document)
        vi.stubGlobal("navigator", dom.window.navigator)
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
        container = document.createElement("div")
        document.body.append(container)
        root = createRoot(container)
        mocks.clear.mockReset()
        mocks.read.mockResolvedValue({
            version: 1,
            entries: [
                {
                    date: "2026-09-07",
                    modelId: "model-a",
                    modelName: "GPT Test",
                    feature: "page-translation",
                    source: "reported",
                    inputTokens: 100,
                    outputTokens: 40,
                    totalTokens: 140,
                    requestCount: 2
                },
                {
                    date: "2026-09-02",
                    modelId: "model-a",
                    modelName: "GPT Test",
                    feature: "concept-explanation",
                    source: "estimated",
                    inputTokens: 20,
                    outputTokens: 10,
                    totalTokens: 30,
                    requestCount: 1
                }
            ]
        })
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-09-07T12:00:00Z"))
    })

    afterEach(async () => {
        await act(async () => root.unmount())
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it("shows range totals, dimensions, sources, and clears after confirmation", async () => {
        const { TokenUsage } = await import("../src/options/TokenUsage")
        await act(async () => root.render(<TokenUsage />))

        expect(container.textContent).toContain("用量统计")
        expect(container.textContent).toContain("今日")
        expect(container.textContent).toContain("140")
        expect(container.textContent).toContain("近 7 天")
        expect(container.textContent).toContain("170")
        expect(container.textContent).toContain("GPT Test")
        expect(container.textContent).toContain("网页翻译")
        expect(container.textContent).toContain("概念解释")
        expect(container.textContent).toContain("API 返回")
        expect(container.textContent).toContain("本地估算")
        expect(container.textContent).toContain("82.4%")
        expect(container.textContent).toContain("17.6%")

        const button = Array.from(container.querySelectorAll("button")).find(
            item => item.textContent === "清空统计"
        )
        await act(async () => button?.click())
        expect(container.textContent).toContain("确认清空")
        const confirm = Array.from(container.querySelectorAll("button")).find(
            item => item.textContent === "确认清空"
        )
        await act(async () => confirm?.click())
        expect(mocks.clear).toHaveBeenCalledOnce()
        expect(container.textContent).toContain("暂无 token 用量记录")
    })
})
