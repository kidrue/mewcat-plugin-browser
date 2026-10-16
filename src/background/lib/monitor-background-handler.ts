import { captureExtensionException, flushSentry } from "@/monitoring"

import { getFailureCause } from "./failure-cause"

const expectedFailureCodes = new Set([
    "INVALID_REQUEST",
    "INVALID_CONFIGURATION",
    "MODEL_NOT_FOUND",
    "MODEL_NOT_VISION_CAPABLE",
    "MODEL_UNAVAILABLE",
    "UNSUPPORTED_IMAGE",
    "NO_TEXT"
])

async function reportFailure(
    error: unknown,
    operation: string,
    pageUrl?: string,
    errorCode?: string,
    status?: number
): Promise<void> {
    try {
        const eventId = captureExtensionException(error, {
            feature: "background-message",
            operation,
            ...(pageUrl ? { pageUrl } : {}),
            ...(errorCode ? { errorCode } : {}),
            ...(status !== undefined ? { status } : {})
        })
        if (eventId) await flushSentry(2000)
    } catch {
        /* Monitoring must not change a business response. */
    }
}

async function reportFailureResponse(
    result: unknown,
    operation: string,
    pageUrl?: string
): Promise<void> {
    if (
        !result ||
        typeof result !== "object" ||
        !("success" in result) ||
        result.success !== false
    )
        return
    const response = result as {
        error?: string | { code?: string; message?: string; status?: number }
        errorCode?: string
        message?: string
    }
    const detail =
        typeof response.error === "object" ? response.error : undefined
    const code = detail?.code ?? response.errorCode ?? "TRANSLATION_FAILED"
    const message =
        detail?.message ??
        (typeof response.error === "string" ? response.error : response.message)
    if (expectedFailureCodes.has(code) || /请求已取消$/.test(message ?? ""))
        return
    const error = new Error(`${operation} failed (${code})`)
    error.name = "BackgroundResponseError"
    const cause = getFailureCause(result)
    if (cause instanceof Error && cause.stack) {
        const frames = cause.stack
            .split("\n")
            .filter(line => /^\s*at\s/.test(line))
        error.stack = `${error.name}: ${error.message}\n${frames.join("\n")}`
    }
    await reportFailure(error, operation, pageUrl, code, detail?.status)
}

export async function monitorBackgroundHandler<T>(
    operation: string,
    handler: () => Promise<T> | T,
    pageUrl?: string
): Promise<T> {
    try {
        const result = await handler()
        await reportFailureResponse(result, operation, pageUrl)
        return result
    } catch (error) {
        await reportFailure(error, operation, pageUrl)
        throw error
    }
}
