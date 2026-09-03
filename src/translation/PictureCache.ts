import {
    createStructuredImageCachePrefix,
    STORAGE_NAMES
} from "@/constants/storage"

import type { ImageTranslationResult } from "../messaging/protocol"

/**
 * 图片翻译缓存管理器
 *
 * 功能：
 * 1. 基于图片内容哈希 + 语言对的缓存
 * 2. 防抖机制，避免重复请求
 * 3. 自动清理过期和最旧的缓存
 * 4. 存储空间管理
 */

// --- Types ---

interface CacheEntry {
    translatedImageUrl: string
    timestamp: number
    size: number // 用于存储管理
}

interface CacheMetadata {
    totalSize: number
    entries: Record<string, { timestamp: number; size: number }>
}

export interface ImageTranslationCacheStorage {
    get(keys: string | string[] | null): Promise<Record<string, unknown>>
    set(values: Record<string, unknown>): Promise<void>
    remove(keys: string | string[]): Promise<void>
}

interface StructuredCacheEntry {
    timestamp: number
    result: ImageTranslationResult
}

interface StructuredCacheMetadata {
    totalSize: number
    entries: Record<string, { timestamp: number; size: number }>
}

export interface ImageTranslationCacheKeyInput {
    imageHash: string
    targetLanguage: string
    modelId: string
    schemaVersion?: number
}

export const IMAGE_TRANSLATION_CACHE_SCHEMA_VERSION = 1
export const IMAGE_TRANSLATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const IMAGE_TRANSLATION_CACHE_MAX_BYTES = 8 * 1024 * 1024

const STRUCTURED_CACHE_PREFIX = createStructuredImageCachePrefix(
    IMAGE_TRANSLATION_CACHE_SCHEMA_VERSION
)
const STRUCTURED_CACHE_METADATA_KEY = `${STRUCTURED_CACHE_PREFIX}metadata`

let structuredCacheStorage: ImageTranslationCacheStorage | null = null
let structuredCacheNow = () => Date.now()
let structuredMutationQueue: Promise<void> = Promise.resolve()
const pendingImageTranslations = new Map<string, Promise<unknown>>()

// --- Constants ---

const CACHE_PREFIX = STORAGE_NAMES.legacyImageCachePrefix
const CACHE_METADATA_KEY = STORAGE_NAMES.legacyImageCacheMetadata
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 1 天
const MAX_STORAGE_USAGE_RATIO = 0.8 // 80% 存储空间上限
const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 // chrome.storage.local 默认约 10MB

// --- In-Memory Debounce Map ---

const pendingRequests = new Map<string, Promise<string>>()

// --- Helper Functions ---

/**
 * 计算 Blob 的 SHA-256 哈希
 */
async function computeBlobHash(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

/**
 * 生成缓存键
 */
function getCacheKey(
    imageHash: string,
    sourceLang: string,
    targetLang: string
): string {
    return `${CACHE_PREFIX}${imageHash}_${sourceLang}_${targetLang}`
}

/**
 * 获取缓存元数据
 */
async function getCacheMetadata(): Promise<CacheMetadata> {
    const result = await chrome.storage.local.get(CACHE_METADATA_KEY)
    return (
        result[CACHE_METADATA_KEY] || {
            totalSize: 0,
            entries: {}
        }
    )
}

/**
 * 更新缓存元数据
 */
async function updateCacheMetadata(metadata: CacheMetadata): Promise<void> {
    await chrome.storage.local.set({ [CACHE_METADATA_KEY]: metadata })
}

/**
 * 检查并清理过期缓存
 */
async function cleanExpiredCache(): Promise<void> {
    const metadata = await getCacheMetadata()
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of Object.entries(metadata.entries)) {
        if (now - entry.timestamp > CACHE_DURATION_MS) {
            expiredKeys.push(key)
        }
    }

    if (expiredKeys.length === 0) {
        return
    }

    console.log(`[PictureCache] 清理 ${expiredKeys.length} 个过期缓存`)

    // 删除过期的缓存条目
    await chrome.storage.local.remove(expiredKeys)

    // 更新元数据
    let freedSize = 0
    for (const key of expiredKeys) {
        freedSize += metadata.entries[key]?.size || 0
        delete metadata.entries[key]
    }
    metadata.totalSize -= freedSize

    await updateCacheMetadata(metadata)
}

/**
 * 清理最旧的缓存，直到存储空间低于阈值
 */
async function cleanOldestCache(): Promise<void> {
    const metadata = await getCacheMetadata()
    const threshold = STORAGE_QUOTA_BYTES * MAX_STORAGE_USAGE_RATIO

    if (metadata.totalSize <= threshold) {
        return
    }

    // 按时间戳排序，最旧的在前
    const sortedEntries = Object.entries(metadata.entries).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
    )

    const keysToRemove: string[] = []
    let freedSize = 0

    for (const [key, entry] of sortedEntries) {
        if (metadata.totalSize - freedSize <= threshold) {
            break
        }
        keysToRemove.push(key)
        freedSize += entry.size
    }

    if (keysToRemove.length === 0) {
        return
    }

    console.log(
        `[PictureCache] 清理 ${keysToRemove.length} 个最旧缓存，释放 ${(freedSize / 1024).toFixed(2)} KB`
    )

    // 删除缓存条目
    await chrome.storage.local.remove(keysToRemove)

    // 更新元数据
    for (const key of keysToRemove) {
        delete metadata.entries[key]
    }
    metadata.totalSize -= freedSize

    await updateCacheMetadata(metadata)
}

// --- Public API ---

/**
 * 从缓存获取翻译结果
 */
export async function getCachedTranslation(
    imageBlob: Blob,
    sourceLang: string,
    targetLang: string
): Promise<string | null> {
    try {
        const imageHash = await computeBlobHash(imageBlob)
        const cacheKey = getCacheKey(imageHash, sourceLang, targetLang)

        const result = await chrome.storage.local.get(cacheKey)
        const entry: CacheEntry | undefined = result[cacheKey]

        if (!entry) {
            return null
        }

        // 检查是否过期
        const now = Date.now()
        if (now - entry.timestamp > CACHE_DURATION_MS) {
            console.log("[PictureCache] 缓存已过期，删除")
            await chrome.storage.local.remove(cacheKey)

            // 更新元数据
            const metadata = await getCacheMetadata()
            if (metadata.entries[cacheKey]) {
                metadata.totalSize -= metadata.entries[cacheKey].size
                delete metadata.entries[cacheKey]
                await updateCacheMetadata(metadata)
            }

            return null
        }

        console.log("[PictureCache] 缓存命中", {
            cacheKey: cacheKey.slice(0, 50),
            age: Math.round((now - entry.timestamp) / 1000 / 60) + " 分钟"
        })

        return entry.translatedImageUrl
    } catch (error) {
        console.error("[PictureCache] 获取缓存失败:", error)
        return null
    }
}

/**
 * 保存翻译结果到缓存
 */
export async function setCachedTranslation(
    imageBlob: Blob,
    sourceLang: string,
    targetLang: string,
    translatedImageUrl: string
): Promise<void> {
    try {
        const imageHash = await computeBlobHash(imageBlob)
        const cacheKey = getCacheKey(imageHash, sourceLang, targetLang)

        // 估算缓存条目大小（URL + 元数据）
        const entrySize = new Blob([translatedImageUrl]).size + 100

        const entry: CacheEntry = {
            translatedImageUrl,
            timestamp: Date.now(),
            size: entrySize
        }

        // 先清理过期缓存
        await cleanExpiredCache()

        // 检查存储空间，必要时清理最旧的缓存
        await cleanOldestCache()

        // 保存缓存
        await chrome.storage.local.set({ [cacheKey]: entry })

        // 更新元数据
        const metadata = await getCacheMetadata()
        if (metadata.entries[cacheKey]) {
            // 更新已有条目
            metadata.totalSize -= metadata.entries[cacheKey].size
        }
        metadata.entries[cacheKey] = {
            timestamp: entry.timestamp,
            size: entry.size
        }
        metadata.totalSize += entry.size

        await updateCacheMetadata(metadata)

        console.log("[PictureCache] 缓存已保存", {
            cacheKey: cacheKey.slice(0, 50),
            size: (entrySize / 1024).toFixed(2) + " KB",
            totalSize: (metadata.totalSize / 1024).toFixed(2) + " KB"
        })
    } catch (error) {
        console.error("[PictureCache] 保存缓存失败:", error)
    }
}

/**
 * 防抖包装器：确保相同的请求只执行一次
 */
export async function withDebounce<T>(
    key: string,
    fn: () => Promise<T>
): Promise<T> {
    // 检查是否有正在进行的请求
    const pending = pendingRequests.get(key)
    if (pending) {
        console.log("[PictureCache] 防抖：复用正在进行的请求", {
            key: key.slice(0, 50)
        })
        return pending as Promise<T>
    }

    // 创建新请求
    const promise = fn().finally(() => {
        // 请求完成后，从 Map 中移除
        pendingRequests.delete(key)
    })

    pendingRequests.set(key, promise as Promise<string>)
    return promise
}

/**
 * 生成防抖键
 */
export async function getDebounceKey(
    imageBlob: Blob,
    sourceLang: string,
    targetLang: string
): Promise<string> {
    const imageHash = await computeBlobHash(imageBlob)
    return getCacheKey(imageHash, sourceLang, targetLang)
}

/**
 * 清理所有缓存（用于测试或重置）
 */
export async function clearAllCache(): Promise<void> {
    const metadata = await getCacheMetadata()
    const allKeys = Object.keys(metadata.entries)

    if (allKeys.length > 0) {
        await chrome.storage.local.remove(allKeys)
    }

    await chrome.storage.local.remove(CACHE_METADATA_KEY)
    console.log(`[PictureCache] 已清理所有缓存 (${allKeys.length} 个条目)`)
}

// --- Versioned structured image-translation cache ---

function defaultStructuredCacheStorage(): ImageTranslationCacheStorage | null {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
        return null
    }
    return chrome.storage.local
}

function getStructuredCacheStorage(): ImageTranslationCacheStorage | null {
    return structuredCacheStorage ?? defaultStructuredCacheStorage()
}

export function configureImageTranslationCache(
    options: {
        storage?: ImageTranslationCacheStorage | null
        now?: () => number
    } = {}
): void {
    structuredCacheStorage = options.storage ?? null
    structuredCacheNow = options.now ?? (() => Date.now())
    structuredMutationQueue = Promise.resolve()
    pendingImageTranslations.clear()
}

export function createImageTranslationCacheKey({
    imageHash,
    targetLanguage,
    modelId,
    schemaVersion = IMAGE_TRANSLATION_CACHE_SCHEMA_VERSION
}: ImageTranslationCacheKeyInput): string {
    const fields = JSON.stringify([
        schemaVersion,
        imageHash,
        targetLanguage,
        modelId
    ])
    return `${createStructuredImageCachePrefix(schemaVersion)}${encodeURIComponent(fields)}`
}

function cloneResult(
    result: ImageTranslationResult,
    cacheHit: boolean
): ImageTranslationResult {
    return {
        ...result,
        cacheHit,
        blocks: result.blocks.map(block => ({
            ...block,
            box: [...block.box] as typeof block.box
        }))
    }
}

function serializedSize(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

function isStructuredCacheEntry(value: unknown): value is StructuredCacheEntry {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as StructuredCacheEntry).timestamp === "number" &&
        typeof (value as StructuredCacheEntry).result === "object" &&
        (value as StructuredCacheEntry).result !== null
    )
}

async function loadStructuredEntries(
    storage: ImageTranslationCacheStorage
): Promise<Map<string, StructuredCacheEntry>> {
    const values = await storage.get(null)
    const entries = new Map<string, StructuredCacheEntry>()
    for (const [key, value] of Object.entries(values)) {
        if (
            key.startsWith(STRUCTURED_CACHE_PREFIX) &&
            key !== STRUCTURED_CACHE_METADATA_KEY &&
            isStructuredCacheEntry(value)
        ) {
            entries.set(key, value)
        }
    }
    return entries
}

function metadataForEntries(
    entries: Map<string, StructuredCacheEntry>
): StructuredCacheMetadata {
    const metadata: StructuredCacheMetadata = { totalSize: 0, entries: {} }
    for (const [key, entry] of entries) {
        const size = serializedSize(entry)
        metadata.entries[key] = { timestamp: entry.timestamp, size }
        metadata.totalSize += size
    }
    return metadata
}

function expiredKeys(
    entries: Map<string, StructuredCacheEntry>,
    now: number
): string[] {
    return [...entries.entries()]
        .filter(
            ([, entry]) =>
                now - entry.timestamp >= IMAGE_TRANSLATION_CACHE_TTL_MS
        )
        .map(([key]) => key)
}

function oldestKeysToEvict(metadata: StructuredCacheMetadata): string[] {
    const keys: string[] = []
    let retainedSize = metadata.totalSize
    for (const [key, entry] of Object.entries(metadata.entries).sort(
        ([firstKey, first], [secondKey, second]) =>
            first.timestamp - second.timestamp ||
            firstKey.localeCompare(secondKey)
    )) {
        if (retainedSize <= IMAGE_TRANSLATION_CACHE_MAX_BYTES) {
            break
        }
        keys.push(key)
        retainedSize -= entry.size
    }
    return keys
}

function enqueueStructuredMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const operation = structuredMutationQueue.then(mutation, mutation)
    structuredMutationQueue = operation.then(
        () => undefined,
        () => undefined
    )
    return operation
}

export async function getCachedImageTranslation(
    input: ImageTranslationCacheKeyInput
): Promise<ImageTranslationResult | null> {
    const storage = getStructuredCacheStorage()
    if (!storage) {
        return null
    }
    const key = createImageTranslationCacheKey(input)
    try {
        const entry = (await storage.get(key))[key] as
            | StructuredCacheEntry
            | undefined
        if (!entry || !entry.result) {
            return null
        }
        const now = structuredCacheNow()
        if (now - entry.timestamp < IMAGE_TRANSLATION_CACHE_TTL_MS) {
            return cloneResult(entry.result, true)
        }
        await enqueueStructuredMutation(async () => {
            const entries = await loadStructuredEntries(storage)
            const current = entries.get(key)
            if (
                !current ||
                now - current.timestamp < IMAGE_TRANSLATION_CACHE_TTL_MS
            ) {
                return
            }
            entries.delete(key)
            await storage.remove(key)
            await storage.set({
                [STRUCTURED_CACHE_METADATA_KEY]: metadataForEntries(entries)
            })
        })
        return null
    } catch {
        return null
    }
}

export async function setCachedImageTranslation(
    input: ImageTranslationCacheKeyInput,
    result: ImageTranslationResult
): Promise<void> {
    if (result.blocks.length === 0) {
        return
    }
    const storage = getStructuredCacheStorage()
    if (!storage) {
        return
    }
    const key = createImageTranslationCacheKey(input)
    try {
        await enqueueStructuredMutation(async () => {
            const now = structuredCacheNow()
            const entries = await loadStructuredEntries(storage)
            const keysToRemove = expiredKeys(entries, now)
            for (const expiredKey of keysToRemove) {
                entries.delete(expiredKey)
            }

            const entry: StructuredCacheEntry = {
                timestamp: now,
                result: {
                    ...cloneResult(result, false),
                    modelId: input.modelId
                }
            }
            entries.set(key, entry)
            const metadata = metadataForEntries(entries)
            for (const oldestKey of oldestKeysToEvict(metadata)) {
                keysToRemove.push(oldestKey)
                entries.delete(oldestKey)
            }
            const finalMetadata = metadataForEntries(entries)
            if (keysToRemove.length > 0) {
                await storage.remove([...new Set(keysToRemove)])
            }
            const values: Record<string, unknown> = {
                [STRUCTURED_CACHE_METADATA_KEY]: finalMetadata
            }
            if (entries.has(key)) {
                values[key] = entry
            }
            await storage.set(values)
        })
    } catch {
        // Cache failures are deliberately transparent to image translation.
    }
}

export function withImageTranslationDeduplication<T>(
    key: string,
    fn: () => Promise<T>
): Promise<T> {
    const pending = pendingImageTranslations.get(key) as Promise<T> | undefined
    if (pending) {
        return pending
    }
    const promise = Promise.resolve().then(fn)
    pendingImageTranslations.set(key, promise)
    return promise.finally(() => pendingImageTranslations.delete(key))
}
