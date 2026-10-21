/**
 * L1 内存缓存
 * 提供快速的内存级缓存访问
 */

import { generateCacheKeySync } from "./cacheKeyGenerator"
import type { CacheEntry, CacheKeyParams, CacheStats } from "./types"

/**
 * L1 内存缓存配置
 */
export interface L1CacheConfig {
    /** 最大缓存条目数 */
    maxSize?: number
    /** 默认TTL（毫秒） */
    defaultTTL?: number
}

/**
 * L1 内存缓存类
 * 使用 Map 实现，支持 LRU 淘汰策略
 */
export class L1MemoryCache {
    private cache = new Map<string, CacheEntry>()
    private readonly maxSize: number
    private readonly defaultTTL: number | null

    constructor(config: L1CacheConfig = {}) {
        this.maxSize = config.maxSize ?? 1000
        this.defaultTTL = config.defaultTTL ?? null
    }

    /**
     * 获取缓存
     * @param params 缓存键参数
     * @returns 翻译结果，未找到返回 null
     */
    get(params: CacheKeyParams): string | null {
        const key = generateCacheKeySync(params)
        const entry = this.cache.get(key)

        if (!entry) {
            return null
        }

        // 检查是否过期
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key)
            return null
        }

        // 更新访问时间和命中次数
        entry.lastAccessTime = Date.now()
        entry.hitCount++

        // 将访问的项移到最后（LRU）
        this.cache.delete(key)
        this.cache.set(key, entry)

        return entry.translation
    }

    /**
     * 设置缓存
     * @param params 缓存键参数
     * @param translation 翻译结果
     * @param ttl 过期时间（毫秒），可选
     */
    set(params: CacheKeyParams, translation: string, ttl?: number): void {
        const key = generateCacheKeySync(params)

        // 如果缓存已满，使用 LRU 策略清理
        if (this.cache.size >= this.maxSize) {
            this.evictLRU()
        }

        const now = Date.now()
        const effectiveTTL = ttl ?? this.defaultTTL
        const entry: CacheEntry = {
            key,
            text: params.text,
            translation,
            sourceLang: params.sourceLang,
            targetLang: params.targetLang,
            modelId: params.modelId,
            aiRole: params.aiRole || "default",
            context: params.context,
            createdAt: now,
            lastAccessTime: now,
            expiresAt: effectiveTTL ? now + effectiveTTL : null,
            hitCount: 0
        }

        this.cache.set(key, entry)
    }

    /**
     * 检查缓存是否存在
     * @param params 缓存键参数
     * @returns 是否存在
     */
    has(params: CacheKeyParams): boolean {
        const key = generateCacheKeySync(params)
        const entry = this.cache.get(key)

        if (!entry) {
            return false
        }

        // 检查是否过期
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key)
            return false
        }

        return true
    }

    /**
     * 删除缓存
     * @param params 缓存键参数
     * @returns 是否删除成功
     */
    delete(params: CacheKeyParams): boolean {
        const key = generateCacheKeySync(params)
        return this.cache.delete(key)
    }

    /**
     * 清空所有缓存
     */
    clear(): void {
        this.cache.clear()
    }

    /**
     * 获取缓存大小
     * @returns 缓存条目数量
     */
    size(): number {
        return this.cache.size
    }

    /**
     * LRU 淘汰策略
     * 移除最久未使用的缓存项
     */
    private evictLRU(): void {
        // Map 的迭代顺序是插入顺序，第一个就是最久未使用的
        const firstKey = this.cache.keys().next().value
        if (firstKey) {
            this.cache.delete(firstKey)
        }
    }

    /**
     * 清理过期缓存
     * @returns 清理的条目数量
     */
    cleanExpired(): number {
        const now = Date.now()
        let cleanedCount = 0

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                this.cache.delete(key)
                cleanedCount++
            }
        }

        return cleanedCount
    }

    /**
     * 根据条件清理缓存
     * @param predicate 判断函数
     * @returns 清理的条目数量
     */
    cleanByPredicate(predicate: (entry: CacheEntry) => boolean): number {
        let cleanedCount = 0

        for (const [key, entry] of this.cache.entries()) {
            if (predicate(entry)) {
                this.cache.delete(key)
                cleanedCount++
            }
        }

        return cleanedCount
    }

    /**
     * 获取缓存统计信息
     * @returns 统计信息
     */
    getStats(): CacheStats {
        let totalHits = 0
        let totalSize = 0

        for (const [key, entry] of this.cache.entries()) {
            totalHits += entry.hitCount
            totalSize += key.length + entry.translation.length
        }

        return {
            size: this.cache.size,
            totalHits,
            estimatedMemory: `${(totalSize / 1024).toFixed(2)} KB`,
            hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0
        }
    }

    /**
     * 获取所有缓存条目（用于持久化）
     * @returns 缓存条目数组
     */
    getAllEntries(): CacheEntry[] {
        return Array.from(this.cache.values())
    }

    /**
     * 批量设置缓存（用于从持久化恢复）
     * @param entries 缓存条目数组
     */
    setEntries(entries: CacheEntry[]): void {
        for (const entry of entries) {
            // 检查是否过期
            if (entry.expiresAt && Date.now() > entry.expiresAt) {
                continue
            }

            // 检查是否超过最大容量
            if (this.cache.size >= this.maxSize) {
                break
            }

            this.cache.set(entry.key, entry)
        }
    }
}
