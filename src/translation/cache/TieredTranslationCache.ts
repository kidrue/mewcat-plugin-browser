/**
 * 分层翻译缓存管理器
 * 整合 L1 内存缓存和 L2 持久化缓存，提供统一的缓存接口
 */

import {
    CacheCleanupManager,
    type CleanupResult,
    type CleanupStrategyConfig
} from "./CacheCleanupManager"
import { L1MemoryCache, type L1CacheConfig } from "./L1MemoryCache"
import { L2PersistentCache, type L2CacheConfig } from "./L2PersistentCache"
import { normalizeText } from "./textNormalizer"
import type { CacheKeyParams, CacheStats } from "./types"

/**
 * 分层缓存配置
 */
export interface TieredCacheConfig {
    /** L1 缓存配置 */
    l1Config?: L1CacheConfig
    /** L2 缓存配置 */
    l2Config?: L2CacheConfig
    /** 清理策略配置 */
    cleanupConfig?: CleanupStrategyConfig
    /** 是否启用 L2 缓存 */
    enableL2?: boolean
    /** 默认 TTL（毫秒） */
    defaultTTL?: number
}

/**
 * 分层翻译缓存管理器
 * 实现 L1（内存）+ L2（IndexedDB）的分层缓存策略
 */
export class TieredTranslationCache {
    private l1Cache: L1MemoryCache
    private l2Cache: L2PersistentCache
    private cleanupManager: CacheCleanupManager
    private enableL2: boolean
    private defaultTTL: number | null
    private initPromise: Promise<void> | null = null

    constructor(config: TieredCacheConfig = {}) {
        this.enableL2 = config.enableL2 ?? true
        this.defaultTTL = config.defaultTTL ?? null

        // 初始化 L1 缓存
        this.l1Cache = new L1MemoryCache({
            maxSize: config.l1Config?.maxSize ?? 1000,
            defaultTTL:
                config.l1Config?.defaultTTL ?? this.defaultTTL ?? undefined
        })

        // 初始化 L2 缓存
        this.l2Cache = new L2PersistentCache({
            dbName: config.l2Config?.dbName,
            storeName: config.l2Config?.storeName,
            version: config.l2Config?.version
        })

        // 初始化清理管理器
        this.cleanupManager = new CacheCleanupManager(
            this.l1Cache,
            this.l2Cache,
            config.cleanupConfig
        )
    }

    /**
     * 初始化缓存系统
     */
    async init(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise
        }

        this.initPromise = (async () => {
            if (this.enableL2) {
                try {
                    await this.l2Cache.init()
                    // 启动清理管理器
                    this.cleanupManager.start()
                } catch (error) {
                    console.error(
                        "[TieredCache] Failed to initialize L2 cache:",
                        error
                    )
                    this.enableL2 = false
                }
            }
        })()

        return this.initPromise
    }

    /**
     * 获取缓存
     * 优先从 L1 获取，未命中则从 L2 获取并回填到 L1
     * @param params 缓存键参数
     * @returns 翻译结果，未找到返回 null
     */
    async get(params: CacheKeyParams): Promise<string | null> {
        // 规范化文本
        const normalizedParams = {
            ...params,
            text: normalizeText(params.text)
        }

        // L1: 内存缓存（快速访问）
        const l1Result = this.l1Cache.get(normalizedParams)
        if (l1Result !== null) {
            return l1Result
        }

        // L2: 持久化缓存
        if (this.enableL2) {
            const l2Result = await this.l2Cache.get(normalizedParams)
            if (l2Result !== null) {
                // 回填到 L1
                this.l1Cache.set(normalizedParams, l2Result)
                return l2Result
            }
        }

        return null
    }

    /**
     * 设置缓存
     * 同时写入 L1 和 L2
     * @param params 缓存键参数
     * @param translation 翻译结果
     * @param ttl 过期时间（毫秒），可选
     */
    async set(
        params: CacheKeyParams,
        translation: string,
        ttl?: number
    ): Promise<void> {
        // 规范化文本
        const normalizedParams = {
            ...params,
            text: normalizeText(params.text)
        }

        const effectiveTTL = ttl ?? this.defaultTTL ?? undefined

        // 写入 L1
        this.l1Cache.set(normalizedParams, translation, effectiveTTL)

        // 写入 L2（异步，不阻塞）
        if (this.enableL2) {
            this.l2Cache
                .set(normalizedParams, translation, effectiveTTL)
                .catch(error => {
                    console.error(
                        "[TieredCache] Failed to set L2 cache:",
                        error
                    )
                })
        }
    }

    /**
     * 批量获取缓存
     * @param paramsList 缓存键参数列表
     * @returns 翻译结果映射（key: 原文, value: 译文）
     */
    async batchGet(paramsList: CacheKeyParams[]): Promise<Map<string, string>> {
        const results = new Map<string, string>()

        await Promise.all(
            paramsList.map(async params => {
                const result = await this.get(params)
                if (result !== null) {
                    results.set(params.text, result)
                }
            })
        )

        return results
    }

    /**
     * 批量设置缓存
     * @param entries 缓存条目列表
     * @param ttl 过期时间（毫秒），可选
     */
    async batchSet(
        entries: Array<{ params: CacheKeyParams; translation: string }>,
        ttl?: number
    ): Promise<void> {
        await Promise.all(
            entries.map(({ params, translation }) =>
                this.set(params, translation, ttl)
            )
        )
    }

    /**
     * 批量删除指定缓存
     * @param paramsList 缓存键参数列表
     */
    async batchDelete(paramsList: CacheKeyParams[]): Promise<void> {
        await Promise.all(paramsList.map(params => this.delete(params)))
    }

    /**
     * 检查缓存是否存在
     * @param params 缓存键参数
     * @returns 是否存在
     */
    async has(params: CacheKeyParams): Promise<boolean> {
        const normalizedParams = {
            ...params,
            text: normalizeText(params.text)
        }

        // 先检查 L1
        if (this.l1Cache.has(normalizedParams)) {
            return true
        }

        // 再检查 L2
        if (this.enableL2) {
            return await this.l2Cache.has(normalizedParams)
        }

        return false
    }

    /**
     * 删除缓存
     * @param params 缓存键参数
     */
    async delete(params: CacheKeyParams): Promise<void> {
        const normalizedParams = {
            ...params,
            text: normalizeText(params.text)
        }

        // 删除 L1
        this.l1Cache.delete(normalizedParams)

        // 删除 L2
        if (this.enableL2) {
            await this.l2Cache.delete(normalizedParams)
        }
    }

    /**
     * 清空所有缓存
     */
    async clear(): Promise<void> {
        this.l1Cache.clear()
        if (this.enableL2) {
            await this.l2Cache.clear()
        }
    }

    /**
     * 获取缓存统计信息
     * @returns 统计信息
     */
    async getStats(): Promise<CacheStats> {
        const l1Stats = this.l1Cache.getStats()
        const l2Stats = this.enableL2
            ? await this.l2Cache.getStats()
            : {
                  size: 0,
                  totalHits: 0,
                  estimatedMemory: "0 KB",
                  hitRate: 0
              }

        return {
            size: l1Stats.size + l2Stats.size,
            totalHits: l1Stats.totalHits + l2Stats.totalHits,
            estimatedMemory: `L1: ${l1Stats.estimatedMemory}, L2: ${l2Stats.estimatedMemory}`,
            hitRate:
                (l1Stats.totalHits + l2Stats.totalHits) /
                    (l1Stats.size + l2Stats.size) || 0,
            l1Size: l1Stats.size,
            l2Size: l2Stats.size
        }
    }

    /**
     * 预热缓存（加载常用短语）
     * @param commonPhrases 常用短语列表
     * @param baseParams 基础参数（不包含 text）
     */
    async warmup(
        commonPhrases: string[],
        baseParams: Omit<CacheKeyParams, "text">
    ): Promise<void> {
        for (const phrase of commonPhrases) {
            await this.get({ ...baseParams, text: phrase })
        }
    }

    /**
     * 手动触发清理
     * @param options 清理选项
     * @returns 清理结果
     */
    async cleanup(options?: {
        maxAge?: number
        maxSize?: number
        minHitCount?: number
    }): Promise<CleanupResult> {
        return await this.cleanupManager.manualClean(options)
    }

    /**
     * 获取清理管理器（用于高级配置）
     */
    getCleanupManager(): CacheCleanupManager {
        return this.cleanupManager
    }

    /**
     * 导出缓存数据（用于备份）
     * @returns 缓存条目数组
     */
    async exportCache(): Promise<
        Array<{
            key: string
            text: string
            translation: string
            sourceLang: string
            targetLang: string
            modelId: string | number
            aiRole: string
            createdAt: number
            hitCount: number
        }>
    > {
        if (!this.enableL2) {
            return []
        }

        const entries = await this.l2Cache.getAllEntries()
        return entries.map(entry => ({
            key: entry.key,
            text: entry.text,
            translation: entry.translation,
            sourceLang: entry.sourceLang,
            targetLang: entry.targetLang,
            modelId: entry.modelId,
            aiRole: entry.aiRole,
            createdAt: entry.createdAt,
            hitCount: entry.hitCount
        }))
    }

    /**
     * 导入缓存数据（用于恢复）
     * @param data 缓存数据
     */
    async importCache(
        data: Array<{
            text: string
            translation: string
            sourceLang: string
            targetLang: string
            modelId: string | number
            aiRole?: string
        }>
    ): Promise<void> {
        for (const entry of data) {
            await this.set(
                {
                    text: entry.text,
                    sourceLang: entry.sourceLang,
                    targetLang: entry.targetLang,
                    modelId: entry.modelId,
                    aiRole: entry.aiRole
                },
                entry.translation
            )
        }
    }

    /**
     * 销毁缓存系统
     */
    destroy(): void {
        // 停止清理管理器
        this.cleanupManager.stop()

        // 清空 L1 缓存
        this.l1Cache.clear()

        // 关闭 L2 数据库连接
        if (this.enableL2) {
            this.l2Cache.close()
        }
    }
}
