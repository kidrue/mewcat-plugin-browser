import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ submit: vi.fn() }))
vi.mock("@/background/lib/mewcat-service", () => ({
    mewCatService: { submitFeedback: mocks.submit }
}))

describe("反馈后台消息", () => {
    beforeEach(() => {
        mocks.submit.mockReset().mockResolvedValue({ accepted: true })
        Object.assign(globalThis, {
            chrome: {
                runtime: {
                    id: "test-extension",
                    getURL: (path: string) =>
                        `chrome-extension://test-extension/${path}`,
                    getManifest: () => ({ version: "1.0.4" })
                }
            }
        })
    })
    const sender = {
        id: "test-extension",
        url: "chrome-extension://test-extension/feedback.html"
    } as chrome.runtime.MessageSender
    it("使用后台版本号，不发送网页上下文，且不要求配置翻译模型", async () => {
        const { handleSubmitFeedback } = await import(
            "../src/background/messages/submit-feedback"
        )
        expect(
            await handleSubmitFeedback(
                {
                    message: "  请改进翻译按钮  ",
                    replyEmail: "reader@example.com"
                },
                sender
            )
        ).toEqual({ success: true })
        expect(mocks.submit).toHaveBeenCalledExactlyOnceWith({
            message: "请改进翻译按钮",
            replyEmail: "reader@example.com",
            extensionVersion: "1.0.4"
        })
    })
    it.each([
        { message: "    " },
        { message: "1234" },
        { message: "字".repeat(5001) },
        { message: "请改进翻译按钮", replyEmail: "bad email" },
        { message: "请改进翻译按钮", to: "other@example.com" }
    ])("拒绝无效消息：%j", async input => {
        const { handleSubmitFeedback } = await import(
            "../src/background/messages/submit-feedback"
        )
        expect(await handleSubmitFeedback(input, sender)).toMatchObject({
            success: false
        })
        expect(mocks.submit).not.toHaveBeenCalled()
    })
    it.each([
        { id: "test-extension", url: "https://example.com" },
        {
            id: "other-extension",
            url: "chrome-extension://test-extension/feedback.html"
        },
        {
            id: "test-extension",
            url: "chrome-extension://test-extension/options.html"
        }
    ])("网页内容脚本或其他来源不能使用反馈接口：%j", async origin => {
        const { handleSubmitFeedback } = await import(
            "../src/background/messages/submit-feedback"
        )
        expect(
            await handleSubmitFeedback({ message: "请改进翻译按钮" }, origin)
        ).toMatchObject({ success: false })
        expect(mocks.submit).not.toHaveBeenCalled()
    })
    it("发送失败返回安全提示，不自动重试", async () => {
        mocks.submit.mockRejectedValue(
            new Error("反馈服务暂不可用，请稍后重试")
        )
        const { handleSubmitFeedback } = await import(
            "../src/background/messages/submit-feedback"
        )
        expect(
            await handleSubmitFeedback({ message: "请改进翻译按钮" }, sender)
        ).toEqual({ success: false, message: "反馈服务暂不可用，请稍后重试" })
        expect(mocks.submit).toHaveBeenCalledOnce()
    })
    it("未知异常不向用户透出内部信息", async () => {
        mocks.submit.mockRejectedValue(new Error("private SMTP credentials"))
        const { handleSubmitFeedback } = await import(
            "../src/background/messages/submit-feedback"
        )
        expect(
            await handleSubmitFeedback({ message: "请改进翻译按钮" }, sender)
        ).toEqual({ success: false, message: "无法提交反馈，请检查网络后重试" })
    })
})
