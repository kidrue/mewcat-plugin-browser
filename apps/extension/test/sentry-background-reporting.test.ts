import { describe, expect, it, vi } from "vitest"

import { withFailureCause } from "@/background/lib/failure-cause"
import { monitorBackgroundHandler } from "@/background/lib/monitor-background-handler"

const { capture, flush } = vi.hoisted(() => ({
    capture: vi.fn(),
    flush: vi.fn().mockResolvedValue(true)
}))
vi.mock("@/monitoring", () => ({
    captureExtensionException: capture,
    flushSentry: flush
}))

describe("background error reporting", () => {
    it("keeps original stack frames without copying provider error text into telemetry", async () => {
        capture.mockClear().mockReturnValue("event-id")
        const cause = new Error("private provider message")
        cause.stack =
            "Error: private provider message\n    at requestProvider (chrome-extension://test/background.js:50:10)"
        const response = withFailureCause(
            {
                success: false,
                error: { code: "NETWORK_FAILURE", message: "safe response" }
            },
            cause
        )
        await monitorBackgroundHandler("model-gateway", async () => response)
        const [reported] = capture.mock.calls[0]
        expect(reported.stack).toContain("requestProvider")
        expect(reported.stack).not.toContain("private provider message")
        expect(JSON.stringify(response)).not.toContain("requestProvider")
    })
    it("reports structured failures even when the handler resolves successfully", async () => {
        capture.mockClear().mockReturnValue("event-id")
        const response = {
            success: false,
            error: {
                code: "NETWORK_FAILURE",
                message: "secret provider response",
                status: 503
            }
        }
        await expect(
            monitorBackgroundHandler("model-gateway", async () => response)
        ).resolves.toBe(response)
        expect(capture).toHaveBeenCalledTimes(1)
        const [error, context] = capture.mock.calls[0]
        expect(error.message).toContain("NETWORK_FAILURE")
        expect(error.message).not.toContain("secret provider response")
        expect(context).toMatchObject({
            feature: "background-message",
            operation: "model-gateway",
            errorCode: "NETWORK_FAILURE",
            status: 503
        })
        expect(flush).toHaveBeenCalled()
    })
    it("reports failed translation responses and ignores explicit cancellation", async () => {
        capture.mockClear().mockReturnValue("event-id")
        await monitorBackgroundHandler("translate-request", async () => ({
            success: false,
            error: "Google 翻译请求超时"
        }))
        expect(capture).toHaveBeenCalledTimes(1)
        capture.mockClear()
        await monitorBackgroundHandler("model-gateway", async () => ({
            success: false,
            error: { code: "TIMEOUT_OR_ABORTED", message: "模型请求已取消" }
        }))
        expect(capture).not.toHaveBeenCalled()
    })
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
                async () => {
                    throw error
                },
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
