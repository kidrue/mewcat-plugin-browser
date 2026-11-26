import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const usageDetails = vi.hoisted(() => vi.fn())
vi.mock("../src/background/lib/mewcat-service", () => ({
    mewCatService: { usageDetails }
}))

const optionsPage = "chrome-extension://test/options.html"
const sender = { id: "test", url: optionsPage + "#translate-services" }

beforeEach(() => {
    usageDetails.mockReset()
    vi.stubGlobal("chrome", {
        runtime: { id: "test", getURL: () => optionsPage }
    })
})

afterEach(() => vi.unstubAllGlobals())

describe("自有服务额度后台消息", () => {
    it("仅允许设置页读取额度", async () => {
        const { handleMewCatUsage } = await import(
            "../src/background/messages/mewcat-usage"
        )
        for (const source of [
            { id: "other", url: optionsPage },
            { id: "test", url: "https://example.org" }
        ]) {
            await expect(handleMewCatUsage(source)).resolves.toEqual({
                success: false
            })
        }
        expect(usageDetails).not.toHaveBeenCalled()
    })

    it("返回经过校验的服务响应，连接失败时给出可重试状态", async () => {
        const details = {
            usedCharacters: 80,
            limitCharacters: 3_000_000,
            ipLimitCharacters: 10_000_000,
            resetsAt: "2026-11-26T00:00:00.000Z"
        }
        usageDetails
            .mockResolvedValueOnce(details)
            .mockRejectedValueOnce(new Error("offline"))
        const { handleMewCatUsage } = await import(
            "../src/background/messages/mewcat-usage"
        )
        await expect(handleMewCatUsage(sender)).resolves.toEqual({
            success: true,
            data: details
        })
        await expect(handleMewCatUsage(sender)).resolves.toEqual({
            success: false
        })
    })
})
