import { describe, expect, it, vi } from "vitest"

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }))
vi.mock("@/monitoring", () => ({ captureExtensionException: capture }))

import { monitorBackgroundHandler } from "@/background/lib/monitor-background-handler"

describe("background error reporting", () => {
    it("preserves successful results without reporting", async () => {
        capture.mockClear()
        await expect(
            monitorBackgroundHandler("translate-request", async () => 42)
        ).resolves.toBe(42)
        expect(capture).not.toHaveBeenCalled()
    })

    it("reports a failure with the sender URL and rethrows it", async () => {
        capture.mockClear()
        const error = new Error("failed")
        const pageUrl = "https://example.com/private?q=kept#fragment"
        await expect(
            monitorBackgroundHandler(
                "translate-request",
                async () => { throw error },
                pageUrl
            )
        ).rejects.toBe(error)
        expect(capture).toHaveBeenCalledExactlyOnceWith(error, {
            feature: "background-message",
            operation: "translate-request",
            pageUrl
        })
    })
})
