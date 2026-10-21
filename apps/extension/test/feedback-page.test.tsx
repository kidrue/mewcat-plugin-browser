// @vitest-environment jsdom
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ submit: vi.fn() }))
vi.mock("@/services/feedback", () => ({ submitFeedback: mocks.submit }))
const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act
let root: Root
beforeEach(() => {
    Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: true,
        chrome: { runtime: { getURL: (path: string) => path } }
    })
    document.body.innerHTML = "<div id=host></div>"
    root = createRoot(document.querySelector("#host")!)
    mocks.submit.mockReset().mockResolvedValue({ success: true })
})
afterEach(async () => {
    await act(async () => root.unmount())
})
async function render() {
    const { default: Feedback } = await import("../src/feedback")
    await act(async () => root.render(<Feedback />))
}
async function fill(id: string, value: string) {
    const field = document.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement
    const prototype =
        field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype
    await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
            field,
            value
        )
        field.dispatchEvent(new Event("input", { bubbles: true }))
    })
}
async function submit() {
    await act(async () => {
        document
            .querySelector("form")!
            .dispatchEvent(
                new Event("submit", { bubbles: true, cancelable: true })
            )
    })
}
describe("独立反馈页", () => {
    it("只发送用户填写的反馈和可选邮箱，成功后明确确认", async () => {
        await render()
        await fill("feedback-message", "  请改进翻译按钮  ")
        await fill("feedback-email", "reader@example.com")
        await submit()
        expect(mocks.submit).toHaveBeenCalledExactlyOnceWith({
            message: "请改进翻译按钮",
            replyEmail: "reader@example.com"
        })
        expect(
            document.querySelector('[role="status"]')?.textContent
        ).toContain("反馈已提交")
        expect(
            (document.getElementById("feedback-message") as HTMLTextAreaElement)
                .value
        ).toBe("")
    })
    it.each(["", "    ", "1234", "字".repeat(5001)])(
        "拒绝空白、过短和过长内容：长度 %s",
        async value => {
            await render()
            await fill("feedback-message", value)
            await submit()
            expect(mocks.submit).not.toHaveBeenCalled()
            expect(document.querySelector('[role="alert"]')).not.toBeNull()
        }
    )
    it("邮箱可留空，但填写时必须有效", async () => {
        await render()
        await fill("feedback-message", "请改进翻译按钮")
        await fill("feedback-email", "bad email")
        await submit()
        expect(mocks.submit).not.toHaveBeenCalled()
        await fill("feedback-email", "")
        await submit()
        expect(mocks.submit).toHaveBeenCalledWith({ message: "请改进翻译按钮" })
    })
    it("提交期间阻止重复发送，失败保留输入并允许重试", async () => {
        let resolve!: (value: { success: false; message: string }) => void
        mocks.submit.mockReturnValueOnce(
            new Promise(r => {
                resolve = r
            })
        )
        await render()
        await fill("feedback-message", "请改进翻译按钮")
        await submit()
        await submit()
        expect(mocks.submit).toHaveBeenCalledOnce()
        expect(
            document.querySelector<HTMLButtonElement>('button[type="submit"]')
                ?.disabled
        ).toBe(true)
        await act(async () =>
            resolve({ success: false, message: "反馈服务暂不可用，请稍后重试" })
        )
        expect(document.querySelector('[role="alert"]')?.textContent).toContain(
            "暂不可用"
        )
        expect(
            (document.getElementById("feedback-message") as HTMLTextAreaElement)
                .value
        ).toBe("请改进翻译按钮")
        await submit()
        expect(mocks.submit).toHaveBeenCalledTimes(2)
    })
    it("网络异常不显示成功或内部错误细节", async () => {
        mocks.submit.mockRejectedValue(new Error("private diagnostic details"))
        await render()
        await fill("feedback-message", "请改进翻译按钮")
        await submit()
        expect(document.querySelector('[role="alert"]')?.textContent).toContain(
            "无法提交反馈"
        )
        expect(document.body.textContent).not.toContain("private diagnostic")
    })
})
