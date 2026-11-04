import type { AnalyticsInput } from "@mewcat/client"

import { sendMessage } from "@/messaging"
import { analyticsFailure } from "@/types/analytics"

export const queryAnalytics = async (input: AnalyticsInput) => {
    try {
        return await sendMessage("analytics-query", input)
    } catch (error) {
        return analyticsFailure(error)
    }
}
export const getAnalyticsIdentity = async () => {
    try {
        return await sendMessage("analytics-identity")
    } catch (error) {
        return analyticsFailure(error)
    }
}
