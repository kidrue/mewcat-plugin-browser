import type {
    CanvasHookEventRequest,
    CanvasHookEventResponse
} from "@/messaging/protocol"

export async function handleCanvasHookEvent(
    payload: CanvasHookEventRequest
): Promise<CanvasHookEventResponse> {
    let host = "unknown"

    if (payload.pageUrl) {
        try {
            host = new URL(payload.pageUrl).hostname
        } catch {
            host = "invalid-url"
        }
    }

    console.warn("[CanvasHookEvent] Main World 错误上报:", {
        host,
        hookStage: payload.error.hookStage,
        code: payload.error.code,
        message: payload.error.message,
        requestId: payload.error.requestId
    })

    return { success: true }
}

export type { CanvasHookEventRequest, CanvasHookEventResponse }
