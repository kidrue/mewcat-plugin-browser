// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sendMessage = vi.hoisted(() => vi.fn())
vi.mock("@/messaging", () => ({ sendMessage }))
vi.mock("@/state", async () => {
    const { atom } = await import("jotai")
    return {
        configAtom: atom({ cacheEnabled: true }),
        updateConfigAtom: atom(null, () => {})
    }
})

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act
let root: Root

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    vi.stubGlobal("chrome", {
        runtime: { getURL: (path: string) => `chrome-extension://test/${path}` }
    })
    document.body.innerHTML = '<div id="host"></div>'
    root = createRoot(document.getElementById("host")!)
    sendMessage.mockReset()
})

afterEach(async () => {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
})

describe("关于页的使用统计开关", () => {
    it("说明统计范围并等待用户主动启用", async () => {
        sendMessage
            .mockResolvedValueOnce({ enabled: false })
            .mockResolvedValueOnce({ enabled: true })
        const { About } = await import("../src/pages/options/About")
        await act(async () => root.render(<About />))

        const toggle = document.querySelector<HTMLInputElement>(
            'input[role="switch"][aria-describedby]'
        )!
        expect(toggle.labels?.[0]?.textContent).toBe("分享使用统计")
        expect(toggle.checked).toBe(false)
        const description = document.getElementById(
            toggle.getAttribute("aria-describedby")!
        )!
        expect(description.textContent).toContain("90 天")
        expect(
            document.querySelector('[role="status"]')?.textContent
        ).toContain("已关闭")
        expect(sendMessage.mock.calls).toEqual([
            ["device-activity", { type: "get-status" }]
        ])

        await act(async () => toggle.click())
        expect(toggle.checked).toBe(true)
        expect(sendMessage.mock.lastCall).toEqual([
            "device-activity",
            { type: "set-enabled", enabled: true }
        ])
    })

    it("关闭后显示清理待重试，重试时仍保持关闭", async () => {
        sendMessage
            .mockResolvedValueOnce({ enabled: true })
            .mockResolvedValueOnce({
                enabled: false,
                message: "服务端删除尚未完成"
            })
            .mockResolvedValueOnce({ enabled: false })
        const { About } = await import("../src/pages/options/About")
        await act(async () => root.render(<About />))

        const toggle = document.querySelector<HTMLInputElement>(
            'input[role="switch"][aria-describedby]'
        )!
        await act(async () => toggle.click())
        expect(toggle.checked).toBe(false)
        expect(
            document.querySelector('[role="status"]')?.textContent
        ).toContain("服务端删除尚未完成")
        const retry = [...document.querySelectorAll("button")].find(
            button => button.textContent === "重试"
        )!
        await act(async () => retry.click())
        expect(
            document.querySelector('[role="status"]')?.textContent
        ).toContain("已关闭")
        expect(sendMessage.mock.lastCall).toEqual([
            "device-activity",
            { type: "set-enabled", enabled: false }
        ])
    })
})
