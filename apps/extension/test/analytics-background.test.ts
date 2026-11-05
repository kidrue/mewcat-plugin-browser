import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ query: vi.fn(), identity: vi.fn() }))
vi.mock("@/background/lib/mewcat-service", () => ({
    mewCatService: {
        queryAnalytics: mocks.query,
        analyticsIdentity: mocks.identity
    }
}))
describe("管理员分析后台消息", () => {
    it("仅发起查询的 options 文档可以取消对应请求", async () => {
        const { handleAnalyticsQuery, handleAnalyticsCancel } = await import(
            "../src/background/messages/analytics"
        )
        const sender = {
            id: "test",
            url: "chrome-extension://test/options.html",
            documentId: "options-one"
        }
        const requestId = crypto.randomUUID()
        mocks.query.mockImplementation(
            (_input, signal: AbortSignal) =>
                new Promise((_resolve, reject) => {
                    signal.addEventListener(
                        "abort",
                        () => reject({ code: "ANALYTICS_CANCELLED" }),
                        { once: true }
                    )
                })
        )
        const waiting = handleAnalyticsQuery(
            {
                requestId,
                query: {
                    operation: "overview",
                    from: "2026-11-01",
                    to: "2026-11-06"
                }
            },
            sender
        )
        const signal = mocks.query.mock.calls[0][1] as AbortSignal
        handleAnalyticsCancel(
            { requestId },
            { ...sender, documentId: "options-two" }
        )
        expect(signal.aborted).toBe(false)
        handleAnalyticsCancel({ requestId }, sender)
        expect(signal.aborted).toBe(true)
        await expect(waiting).resolves.toMatchObject({
            success: false,
            code: "ANALYTICS_CANCELLED"
        })
    })
    beforeEach(() => {
        mocks.query.mockReset()
        mocks.identity.mockReset()
        Object.assign(globalThis, {
            chrome: {
                runtime: {
                    id: "test",
                    getURL: (path: string) => `chrome-extension://test/${path}`
                }
            }
        })
    })
    it("拒绝网页、popup、feedback、其他扩展和缺少来源的调用", async () => {
        const { handleAnalyticsQuery, handleAnalyticsIdentity } = await import(
            "../src/background/messages/analytics"
        )
        for (const sender of [
            { id: "test", url: "https://example.com" },
            { id: "test", url: "chrome-extension://test/popup.html" },
            { id: "test", url: "chrome-extension://test/feedback.html" },
            { id: "other", url: "chrome-extension://test/options.html" },
            { id: "test" }
        ]) {
            expect(await handleAnalyticsQuery({}, sender)).toMatchObject({
                success: false
            })
            expect(await handleAnalyticsIdentity(sender)).toMatchObject({
                success: false
            })
        }
        expect(mocks.query).not.toHaveBeenCalled()
        expect(mocks.identity).not.toHaveBeenCalled()
    })
    it("仅 options 查询有效参数，未知异常不暴露秘密", async () => {
        const { handleAnalyticsQuery } = await import(
            "../src/background/messages/analytics"
        )
        const sender = {
            id: "test",
            url: "chrome-extension://test/options.html#analytics"
        }
        expect(
            await handleAnalyticsQuery({ operation: "bad" }, sender)
        ).toMatchObject({ success: false, code: "INVALID_REQUEST" })
        mocks.query.mockRejectedValue(new Error("private credentials"))
        expect(
            await handleAnalyticsQuery(
                {
                    requestId: crypto.randomUUID(),
                    query: {
                        operation: "overview",
                        from: "2026-11-01",
                        to: "2026-11-06"
                    }
                },
                sender
            )
        ).toEqual({
            success: false,
            code: "NETWORK_FAILURE",
            message: "无法读取分析数据，请检查网络后重试"
        })
    })
})
