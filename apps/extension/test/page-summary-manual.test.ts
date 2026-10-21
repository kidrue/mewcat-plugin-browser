// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PageSummaryController } from "../src/page-summary/PageSummaryController"
import { defaultExtensionConfig } from "../src/state/constants"

const mocks = vi.hoisted(() => ({
    send: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    render: vi.fn(),
    model: { id: "ai", params: {} }
}))
vi.mock("@/messaging", () => ({ sendMessage: mocks.send }))
vi.mock("@/monitoring", () => ({ captureExtensionException: vi.fn() }))
vi.mock("../src/utils/pageSummary", () => ({
    selectPageSummaryModel: () => mocks.model
}))
vi.mock("../src/page-summary/PageSummaryRenderer", () => ({
    renderPageSummary: mocks.render
}))
beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, "location", "get").mockReturnValue({
        protocol: "https:",
        hostname: "example.com",
        href: "https://example.com/article"
    } as Location)
    document.body.innerHTML = `<article><h1>Example</h1><p>${"Readable article text. ".repeat(30)}</p></article>`
    mocks.render.mockReturnValue({
        update: mocks.update,
        remove: mocks.remove,
        open: vi.fn()
    })
    mocks.send.mockResolvedValue({
        success: true,
        text: "这是一篇文章的总结。"
    })
})
describe("manual page summary", () => {
    it("runs without enabling automatic summaries and deduplicates pending requests", async () => {
        let resolve!: (value: unknown) => void
        mocks.send.mockReturnValue(
            new Promise(r => {
                resolve = r
            })
        )
        const config = { ...defaultExtensionConfig, enablePageSummary: false }
        const controller = new PageSummaryController(config)
        const first = controller.start("manual")
        const second = controller.start("manual")
        expect(mocks.send).toHaveBeenCalledTimes(1)
        resolve({ success: true, text: "总结完成。" })
        await Promise.all([first, second])
        expect(config.enablePageSummary).toBe(false)
        expect(mocks.update).toHaveBeenCalledWith(
            expect.objectContaining({ status: "success" })
        )
    })
    it("explains website exclusion without requesting a model", async () => {
        const controller = new PageSummaryController({
            ...defaultExtensionConfig,
            pageSummaryDisabledSites: ["example.com"]
        })
        const result = await controller.start("manual")
        expect(result?.message).toContain("禁用")
        expect(mocks.send).not.toHaveBeenCalled()
    })
    it("does not update a cancelled renderer after a late response", async () => {
        let resolve!: (value: unknown) => void
        mocks.send.mockReturnValue(
            new Promise(r => {
                resolve = r
            })
        )
        const controller = new PageSummaryController(defaultExtensionConfig)
        const pending = controller.start("manual")
        controller.cancel()
        resolve({ success: true, text: "迟到结果。" })
        await pending
        expect(mocks.update).not.toHaveBeenCalled()
    })
})
