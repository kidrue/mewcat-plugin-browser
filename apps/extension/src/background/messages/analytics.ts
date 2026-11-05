import { analyticsQuerySchema } from "@mewcat/client"
import { z } from "zod"

import {
    analyticsFailure,
    type AnalyticsIdentityResponse,
    type AnalyticsResponse
} from "@/types/analytics"

import { mewCatService } from "../lib/mewcat-service"

const requestIdSchema = z.string().uuid()
const pending = new Map<
    string,
    { owner: string; controller: AbortController }
>()
const ownerOf = (sender: chrome.runtime.MessageSender) =>
    sender.documentId ??
    `tab:${sender.tab?.id ?? "options"}:${sender.frameId ?? 0}`

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
    const message = (input && typeof input === "object" ? input : {}) as {
        requestId?: unknown
        query?: unknown
    }
    const id = requestIdSchema.safeParse(message.requestId)
    const parsed = analyticsQuerySchema.safeParse(message.query)
    if (!parsed.success || !id.success || pending.has(id.data)) {
        return analyticsFailure({ code: "INVALID_REQUEST" })
    }
    if (pending.size >= 16) {
        return analyticsFailure({ code: "ANALYTICS_BUSY" })
    }
    const controller = new AbortController()
    pending.set(id.data, { owner: ownerOf(sender), controller })
    try {
        return {
            success: true,
            data: await mewCatService.queryAnalytics(
                parsed.data,
                controller.signal
            )
        }
    } catch (error) {
        if (controller.signal.aborted) {
            return analyticsFailure({ code: "ANALYTICS_CANCELLED" })
        }
        return analyticsFailure(error)
    } finally {
        pending.delete(id.data)
    }
}
export function handleAnalyticsCancel(
    input: { requestId: string },
    sender: chrome.runtime.MessageSender
) {
    if (!isOptions(sender)) {
        return { success: false }
    }
    const id = requestIdSchema.safeParse(input?.requestId)
    if (!id.success) {
        return { success: false }
    }
    const request = pending.get(id.data)
    if (request?.owner === ownerOf(sender)) {
        request.controller.abort()
    }
    return { success: true }
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
