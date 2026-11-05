import type { AnalyticsInput } from "@mewcat/client"

import { sendMessage } from "@/messaging"
import { analyticsFailure } from "@/types/analytics"

export const queryAnalytics = async (
    input: AnalyticsInput,
    signal?: AbortSignal
) => {
    const requestId = crypto.randomUUID()
    const cancel = () => {
        void sendMessage("analytics-cancel", { requestId }).catch(() => {})
    }
    if (signal?.aborted) {
        return analyticsFailure({ code: "ANALYTICS_CANCELLED" })
    }
    signal?.addEventListener("abort", cancel, { once: true })
    window.addEventListener("pagehide", cancel, { once: true })
    try {
        return await sendMessage("analytics-query", { requestId, query: input })
    } catch (error) {
        return analyticsFailure(error)
    } finally {
        signal?.removeEventListener("abort", cancel)
        window.removeEventListener("pagehide", cancel)
    }
}
export const getAnalyticsIdentity = async () => {
    try {
        return await sendMessage("analytics-identity")
    } catch (error) {
        return analyticsFailure(error)
    }
}
