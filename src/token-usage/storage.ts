import { z } from "zod"

import { STORAGE_NAMES } from "@/constants/storage"

import {
    TOKEN_USAGE_FEATURES,
    type TokenUsageEntry,
    type TokenUsageEvent,
    type TokenUsageStore
} from "./types"

const nonNegativeInteger = z.number().finite().nonnegative().int().catch(0)
const entrySchema = z.object({
    date: z.string(),
    modelId: z.string(),
    modelName: z.string().catch("未知模型"),
    feature: z.enum(TOKEN_USAGE_FEATURES),
    source: z.enum(["reported", "estimated"]),
    inputTokens: nonNegativeInteger,
    outputTokens: nonNegativeInteger,
    totalTokens: nonNegativeInteger,
    requestCount: nonNegativeInteger
})

export interface TokenUsageStorageArea {
    get(key: string): Promise<Record<string, unknown>>
    set(items: Record<string, unknown>): Promise<void>
    remove(key: string): Promise<void>
}

export interface TokenUsageStorageDependencies {
    storage?: TokenUsageStorageArea
    key?: string
    now?: () => Date
}

const defaultStorage = (): TokenUsageStorageArea => chrome.storage.local
const dateString = (date: Date) => date.toISOString().slice(0, 10)
const retentionStart = (now: Date) => {
    const value = new Date(now)
    value.setUTCDate(value.getUTCDate() - 29)
    return dateString(value)
}

const resolve = (dependencies: TokenUsageStorageDependencies) => ({
    storage: dependencies.storage ?? defaultStorage(),
    key: dependencies.key ?? STORAGE_NAMES.tokenUsage,
    now: dependencies.now ?? (() => new Date())
})

const repairEntries = (value: unknown, now: Date): TokenUsageEntry[] => {
    if (!value || typeof value !== "object") {
        return []
    }
    const entries = (value as { entries?: unknown }).entries
    if (!Array.isArray(entries)) {
        return []
    }
    const minimumDate = retentionStart(now)
    return entries.flatMap(item => {
        const result = entrySchema.safeParse(item)
        if (
            !result.success ||
            !/^\d{4}-\d{2}-\d{2}$/.test(result.data.date) ||
            result.data.date < minimumDate
        ) {
            return []
        }
        return [
            {
                ...result.data,
                modelName: result.data.modelName ?? "未知模型",
                inputTokens: result.data.inputTokens ?? 0,
                outputTokens: result.data.outputTokens ?? 0,
                totalTokens: result.data.totalTokens ?? 0,
                requestCount: result.data.requestCount ?? 0
            }
        ]
    })
}

export async function readTokenUsage(
    dependencies: TokenUsageStorageDependencies = {}
): Promise<TokenUsageStore> {
    const { storage, key, now } = resolve(dependencies)
    const stored = await storage.get(key)
    return { version: 1, entries: repairEntries(stored[key], now()) }
}

let writeQueue = Promise.resolve()

export function recordTokenUsage(
    event: TokenUsageEvent,
    dependencies: TokenUsageStorageDependencies = {}
): Promise<void> {
    const operation = writeQueue.then(async () => {
        const resolved = resolve(dependencies)
        const store = await readTokenUsage(dependencies)
        const date = event.date ?? dateString(resolved.now())
        const existing = store.entries.find(
            item =>
                item.date === date &&
                item.modelId === event.modelId &&
                item.feature === event.feature &&
                item.source === event.source
        )
        if (existing) {
            existing.modelName = event.modelName
            existing.inputTokens += event.counts.inputTokens
            existing.outputTokens += event.counts.outputTokens
            existing.totalTokens += event.counts.totalTokens
            existing.requestCount += 1
        } else {
            store.entries.push({
                date,
                modelId: event.modelId,
                modelName: event.modelName,
                feature: event.feature,
                source: event.source,
                ...event.counts,
                requestCount: 1
            })
        }
        await resolved.storage.set({ [resolved.key]: store })
    })
    writeQueue = operation.catch(() => undefined)
    return operation
}

export async function clearTokenUsage(
    dependencies: TokenUsageStorageDependencies = {}
): Promise<void> {
    const { storage, key } = resolve(dependencies)
    await storage.remove(key)
}
