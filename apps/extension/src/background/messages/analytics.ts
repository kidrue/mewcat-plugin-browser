import { analyticsQuerySchema } from "@mewcat/client"

import {
    analyticsFailure,
    type AnalyticsIdentityResponse,
    type AnalyticsResponse
} from "@/types/analytics"

import { mewCatService } from "../lib/mewcat-service"

function isOptions(sender: chrome.runtime.MessageSender) {
    return (
        sender.id === chrome.runtime.id &&
        sender.url?.split(/[?#]/, 1)[0] ===
            chrome.runtime.getURL("options.html")
    )
}
export async function handleAnalyticsQuery(
    input: unknown,
    sender: chrome.runtime.MessageSender
): Promise<AnalyticsResponse> {
    if (!isOptions(sender)) {
        return analyticsFailure({ code: "ANALYTICS_FORBIDDEN" })
    }
    const parsed = analyticsQuerySchema.safeParse(input)
    if (!parsed.success) {
        return analyticsFailure({ code: "INVALID_REQUEST" })
    }
    try {
        return {
            success: true,
            data: await mewCatService.queryAnalytics(parsed.data)
        }
    } catch (error) {
        return analyticsFailure(error)
    }
}
export async function handleAnalyticsIdentity(
    sender: chrome.runtime.MessageSender
): Promise<AnalyticsIdentityResponse> {
    if (!isOptions(sender)) {
        return analyticsFailure({ code: "ANALYTICS_FORBIDDEN" })
    }
    try {
        return { success: true, data: await mewCatService.analyticsIdentity() }
    } catch (error) {
        return analyticsFailure(error)
    }
}
