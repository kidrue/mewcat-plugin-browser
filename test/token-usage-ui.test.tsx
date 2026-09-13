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

    const getButton = (label: string) => {
        const button = Array.from(container.querySelectorAll("button")).find(
            item => item.textContent === label
        )
        expect(button, `Expected button: ${label}`).toBeDefined()
        return button!
    }

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
        mocks.read.mockReset()
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

        await act(async () => getButton("清空统计").click())
        expect(container.textContent).toContain("确认清空")
        await act(async () => getButton("确认清空").click())
        expect(mocks.clear).toHaveBeenCalledOnce()
        expect(container.textContent).toContain("暂无 token 用量记录")
    })

    it("keeps totals unavailable and clearing disabled when reading fails", async () => {
        let rejectRead!: (reason: unknown) => void
        mocks.read.mockReturnValue(
            new Promise((_resolve, reject) => {
                rejectRead = reject
            })
        )
        const { TokenUsage } = await import("../src/options/TokenUsage")
        await act(async () => root.render(<TokenUsage />))

        const overview = container.querySelector(
            '[aria-label="Token 用量概览"]'
        )!
        expect(overview.getAttribute("aria-busy")).toBe("true")
        expect(overview.textContent).toContain("正在读取本地统计")
        expect(getButton("清空统计").disabled).toBe(true)

        await act(async () => rejectRead(new Error("Storage unavailable")))

        expect(overview.getAttribute("aria-busy")).toBe("false")
        expect(container.querySelector('[role="alert"]')?.textContent).toBe(
            "无法读取本地统计，请重新打开此页重试。"
        )
        expect(overview.querySelectorAll("article")).toHaveLength(3)
        for (const card of overview.querySelectorAll("article")) {
            expect(card.textContent).toContain("—tokens")
            expect(card.textContent).toContain("统计暂不可用")
            expect(card.textContent).not.toContain("输入 0")
        }
        expect(container.textContent).not.toContain("0.0%")
        expect(container.textContent).not.toContain("暂无 token 用量记录")
        expect(container.querySelector("table")).toBeNull()
        expect(getButton("清空统计").disabled).toBe(true)
        await act(async () => getButton("清空统计").click())
        expect(mocks.clear).not.toHaveBeenCalled()
    })

    it("disables confirmation and cancellation while clearing is pending", async () => {
        let resolveClear!: () => void
        mocks.clear.mockReturnValue(
            new Promise<void>(resolve => {
                resolveClear = resolve
            })
        )
        const { TokenUsage } = await import("../src/options/TokenUsage")
        await act(async () => root.render(<TokenUsage />))
        await act(async () => getButton("清空统计").click())
        await act(async () => getButton("确认清空").click())

        expect(mocks.clear).toHaveBeenCalledOnce()
        expect(getButton("正在清空…").disabled).toBe(true)
        expect(getButton("取消").disabled).toBe(true)
        expect(container.querySelectorAll("tbody tr")).toHaveLength(2)
        await act(async () => {
            getButton("正在清空…").click()
            getButton("取消").click()
        })
        expect(mocks.clear).toHaveBeenCalledOnce()
        expect(getButton("正在清空…").disabled).toBe(true)

        await act(async () => resolveClear())
        expect(container.textContent).toContain("暂无 token 用量记录")
        expect(container.querySelector("table")).toBeNull()
        expect(getButton("清空统计").disabled).toBe(false)
    })

    it("preserves statistics after a failed clear and allows a successful retry", async () => {
        mocks.clear
            .mockRejectedValueOnce(new Error("Storage write failed"))
            .mockResolvedValueOnce(undefined)
        const { TokenUsage } = await import("../src/options/TokenUsage")
        await act(async () => root.render(<TokenUsage />))
        const originalRows = container.querySelector("tbody")?.textContent
        const originalOverview = container.querySelector(
            '[aria-label="Token 用量概览"]'
        )?.textContent
        await act(async () => getButton("清空统计").click())
        await act(async () => getButton("确认清空").click())

        expect(mocks.clear).toHaveBeenCalledOnce()
        expect(container.querySelector('[role="alert"]')?.textContent).toBe(
            "清空失败，统计仍然保留，请重试。"
        )
        expect(container.querySelector("tbody")?.textContent).toBe(originalRows)
        expect(
            container.querySelector('[aria-label="Token 用量概览"]')
                ?.textContent
        ).toBe(originalOverview)
        expect(getButton("清空统计").disabled).toBe(false)

        await act(async () => getButton("清空统计").click())
        expect(getButton("确认清空").disabled).toBe(false)
        await act(async () => getButton("确认清空").click())

        expect(mocks.clear).toHaveBeenCalledTimes(2)
        expect(container.querySelector('[role="alert"]')).toBeNull()
        expect(container.textContent).toContain("暂无 token 用量记录")
        expect(container.querySelector("table")).toBeNull()
    })
})
