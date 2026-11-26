// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sendMessage = vi.hoisted(() => vi.fn())
vi.mock("@/messaging", () => ({ sendMessage }))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act
let root: Root

const details = {
    usedCharacters: 320_000,
    limitCharacters: 3_000_000,
    ipLimitCharacters: 10_000_000,
    resetsAt: "2026-11-26T00:00:00.000Z"
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    document.body.innerHTML = '<div id="host"></div>'
    root = createRoot(document.getElementById("host")!)
    sendMessage.mockReset()
})

afterEach(async () => {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
})

describe("自有翻译服务额度提示", () => {
    it("用服务器返回的额度显示设备、共享网络和重置时间", async () => {
        sendMessage.mockResolvedValue({ success: true, data: details })
        const { MewCatQuota } = await import("../src/components/MewCatQuota")
        await act(async () => root.render(<MewCatQuota />))

        expect(sendMessage).toHaveBeenCalledExactlyOnceWith(
            "mewcat-usage",
            undefined
        )
        expect(document.body.textContent).toContain("3,000,000")
        expect(document.body.textContent).toContain("10,000,000")
        expect(document.body.textContent).toContain("已用 320,000")
        expect(document.body.textContent).toContain("剩余 2,680,000")
        expect(document.body.textContent).toContain("北京时间 08:00")
    })

    it("失败后可重新读取并把剩余额度限制在零", async () => {
        sendMessage.mockRejectedValueOnce(new Error("offline"))
        sendMessage.mockResolvedValueOnce({
            success: true,
            data: { ...details, usedCharacters: 3_500_000 }
        })
        const { MewCatQuota } = await import("../src/components/MewCatQuota")
        await act(async () => root.render(<MewCatQuota />))

        expect(document.body.textContent).toContain("暂时无法读取")
        const retry = document.querySelector<HTMLButtonElement>("button")!
        await act(async () => retry.click())

        expect(sendMessage).toHaveBeenCalledTimes(2)
        expect(document.body.textContent).toContain("剩余 0 字符")
    })
})
