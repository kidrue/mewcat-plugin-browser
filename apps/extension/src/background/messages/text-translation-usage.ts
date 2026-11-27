import { z } from "zod"

import { STORAGE_NAMES } from "@/constants/storage"
import {
    localTextTranslationUsageDate,
    type TextTranslationUsageEntry,
    type TextTranslationUsageRequest
} from "@/features/token-usage"

const key = STORAGE_NAMES.textTranslationUsage
const retentionDays = 62
const eventSchema = z.object({
    serviceId: z.string().min(1),
    serviceName: z.string().min(1),
    characters: z.number().int().positive()
})
const entrySchema = eventSchema.extend({
    date: z.iso.date()
})

async function readEntries(
    now: Date
): Promise<{ entries: TextTranslationUsageEntry[]; needsRepair: boolean }> {
    const stored: unknown = (await chrome.storage.local.get(key))[key]
    if (!Array.isArray(stored)) {
        return { entries: [], needsRepair: stored !== undefined }
    }
    const oldest = new Date(now)
    oldest.setDate(now.getDate() - retentionDays + 1)
    const minimumDate = localTextTranslationUsageDate(oldest)
    const entries = stored.flatMap(item => {
        const parsed = entrySchema.safeParse(item)
        return parsed.success && parsed.data.date >= minimumDate
            ? [parsed.data]
            : []
    })
    return { entries, needsRepair: entries.length !== stored.length }
}

let queue = Promise.resolve()

export function handleTextTranslationUsage(
    request: TextTranslationUsageRequest,
    sender: chrome.runtime.MessageSender
): Promise<TextTranslationUsageEntry[] | undefined> {
    if (
        sender.id !== chrome.runtime.id ||
        (request.type !== "record" &&
            sender.url?.split(/[?#]/, 1)[0] !==
                chrome.runtime.getURL("options.html"))
    ) {
        return Promise.reject(new Error("无权访问翻译字符统计"))
    }

    const now = new Date()
    const operation = queue.then(async () => {
        if (request.type === "read") {
            const { entries, needsRepair } = await readEntries(now)
            if (needsRepair) {
                if (entries.length) {
                    await chrome.storage.local.set({ [key]: entries })
                } else {
                    await chrome.storage.local.remove(key)
                }
            }
            return entries
        }
        if (request.type === "clear") {
            await chrome.storage.local.remove(key)
            return
        }

        const parsed = eventSchema.safeParse(request)
        if (!parsed.success) {
            return
        }
        const event = parsed.data
        const date = localTextTranslationUsageDate(now)
        const { entries } = await readEntries(now)
        const existing = entries.find(
            entry => entry.date === date && entry.serviceId === event.serviceId
        )
        if (existing) {
            existing.serviceName = event.serviceName
            existing.characters += event.characters
        } else {
            entries.push({ date, ...event })
        }
        await chrome.storage.local.set({ [key]: entries })
    })

    queue = operation.then(
        () => undefined,
        () => undefined
    )
    return operation
}
