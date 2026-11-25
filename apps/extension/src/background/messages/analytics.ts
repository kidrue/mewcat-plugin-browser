import { analyticsQuerySchema, deviceActivityQuerySchema } from "@mewcat/client"
import type {
    AnalyticsInput,
    AnalyticsResult,
    DeviceActivityAnalytics,
    DeviceActivityQuery
} from "@mewcat/client"
import { z } from "zod"

import type { DeviceActivityQueryResponse } from "@/messaging/protocol"
import {
    analyticsFailure,
    type AnalyticsFailure,
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
async function runOptionsQuery<Query, Data>(
    input: unknown,
    sender: chrome.runtime.MessageSender,
    parseQuery: (
        input: unknown
    ) => { success: true; data: Query } | { success: false },
    query: (input: Query, signal: AbortSignal) => Promise<Data>
): Promise<{ success: true; data: Data } | AnalyticsFailure> {
    if (!isOptions(sender)) {
        return analyticsFailure({ code: "ANALYTICS_FORBIDDEN" })
    }
    const message = (input && typeof input === "object" ? input : {}) as {
        requestId?: unknown
        query?: unknown
    }
    const id = requestIdSchema.safeParse(message.requestId)
    const parsed = parseQuery(message.query)
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
            data: await query(parsed.data, controller.signal)
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
export function handleAnalyticsQuery(
    input: unknown,
    sender: chrome.runtime.MessageSender
): Promise<AnalyticsResponse> {
    return runOptionsQuery<AnalyticsInput, AnalyticsResult>(
        input,
        sender,
        raw => analyticsQuerySchema.safeParse(raw),
        (query, signal) => mewCatService.queryAnalytics(query, signal)
    )
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

export function handleDeviceActivityQuery(
    input: unknown,
    sender: chrome.runtime.MessageSender
): Promise<DeviceActivityQueryResponse> {
    return runOptionsQuery<DeviceActivityQuery, DeviceActivityAnalytics>(
        input,
        sender,
        raw => deviceActivityQuerySchema.safeParse(raw),
        (query, signal) => mewCatService.queryDeviceActivity(query, signal)
    )
}
