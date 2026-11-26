import type { MewCatUsageResponse } from "@/types/mewcatUsage"

import { mewCatService } from "../lib/mewcat-service"

export async function handleMewCatUsage(
    sender: chrome.runtime.MessageSender
): Promise<MewCatUsageResponse> {
    if (
        sender.id !== chrome.runtime.id ||
        sender.url?.split(/[?#]/, 1)[0] !==
            chrome.runtime.getURL("options.html")
    ) {
        return { success: false }
    }

    try {
        return { success: true, data: await mewCatService.usageDetails() }
    } catch {
        return { success: false }
    }
}
