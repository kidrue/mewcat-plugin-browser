import type {
    InjectMainWorldHookRequest,
    InjectMainWorldHookResponse
} from "@/messaging/protocol"

import { installMewCatCanvasImageHook } from "../../contents/inject/canvas-image-hook"
import {
    CANVAS_HOOK_CHANNEL,
    CANVAS_HOOK_VERSION
} from "../../types/canvas-hook"
import { getCanvasRolloutDecision } from "../config/canvas-sites"

export async function handleInjectMainWorldHook(
    request: InjectMainWorldHookRequest,
    sender: chrome.runtime.MessageSender
): Promise<InjectMainWorldHookResponse> {
    const tabId = sender.tab?.id
    const pageUrl = request.pageUrl || sender.tab?.url

    if (!tabId) {
        return {
            success: false,
            error: "缺少 tabId，无法注入 Main World hook"
        }
    }

    const decision = getCanvasRolloutDecision(pageUrl)
    if (!decision.enabled) {
        return {
            success: true,
            injected: false,
            skipped: true,
            reason: `当前站点未开启 canvas hook: ${decision.reason}`
        }
    }

    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: installMewCatCanvasImageHook,
            args: [CANVAS_HOOK_CHANNEL, CANVAS_HOOK_VERSION]
        })

        return {
            success: true,
            injected: true
        }
    } catch (error) {
        console.error("[CanvasHook] Main World 注入失败:", error)
        return {
            success: false,
            error:
                error instanceof Error ? error.message : "Main World 注入失败"
        }
    }
}

export type { InjectMainWorldHookRequest, InjectMainWorldHookResponse }
