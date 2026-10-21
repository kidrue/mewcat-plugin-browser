/**
 * 缓存清理管理器
 * 负责定期清理过期、低频、超容量的缓存
 */

import type { L1MemoryCache } from "./L1MemoryCache"
import type { L2PersistentCache } from "./L2PersistentCache"
import type { CleanupOptions } from "./types"

/**
 * 清理策略配置
 */
export interface CleanupStrategyConfig {
    /** 是否启用自动清理 */
    enabled?: boolean
    /** 清理间隔（毫秒） */
    interval?: number
    /** 最大缓存年龄（毫秒，默认7天） */
    maxAge?: number
    /** 最大缓存条目数（L2） */
    maxSize?: number
    /** 最小命中次数 */
    minHitCount?: number
}

/**
 * 清理结果
 */
export interface CleanupResult {
    /** L1清理的条目数 */
    l1Cleaned: number
    /** L2清理的条目数 */
    l2Cleaned: number
    /** 总清理条目数 */
    totalCleaned: number
    /** 清理耗时（毫秒） */
    duration: number
    /** 清理类型 */
    type: "expired" | "old" | "lowFrequency" | "overCapacity" | "manual"
}

/**
 * 缓存清理管理器
 */
export class CacheCleanupManager {
    private l1Cache: L1MemoryCache
    private l2Cache: L2PersistentCache
    private config: Required<CleanupStrategyConfig>
    private cleanupTimer: NodeJS.Timeout | null = null
    private isRunning = false

    constructor(
        l1Cache: L1MemoryCache,
        l2Cache: L2PersistentCache,
        config: CleanupStrategyConfig = {}
    ) {
        this.l1Cache = l1Cache
        this.l2Cache = l2Cache
        this.config = {
            enabled: config.enabled ?? true,
            interval: config.interval ?? 60 * 60 * 1000, // 默认1小时
            maxAge: config.maxAge ?? 7 * 24 * 60 * 60 * 1000, // 默认7天
            maxSize: config.maxSize ?? 10000, // 默认10000条
            minHitCount: config.minHitCount ?? 0 // 默认不清理低频缓存
        }
    }

    /**
     * 启动自动清理
     */
    start(): void {
        if (!this.config.enabled || this.cleanupTimer) {
            return
        }

        // 立即执行一次清理
        this.runCleanup().catch(() => {})

        // 设置定时清理
        this.cleanupTimer = setInterval(() => {
            this.runCleanup().catch(() => {})
        }, this.config.interval)
    }

    /**
     * 停止自动清理
     */
    stop(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer)
            this.cleanupTimer = null
        }
    }

    /**
     * 执行清理任务
     */
    private async runCleanup(): Promise<void> {
        if (this.isRunning) {
            return
        }

        this.isRunning = true

        try {
            // 1. 清理过期缓存
            await this.cleanExpired()

            // 2. 清理旧缓存
            await this.cleanOld(this.config.maxAge)

            // 3. 清理低频缓存（如果配置了）
            if (this.config.minHitCount > 0) {
                await this.cleanLowFrequency(this.config.minHitCount)
            }

            // 4. 清理超容量缓存
            await this.cleanOverCapacity(this.config.maxSize)
        } catch (error) {
            console.error("[CacheCleanup] Cleanup failed:", error)
        } finally {
            this.isRunning = false
        }
    }

    /**
     * 清理过期缓存
     */
    async cleanExpired(): Promise<CleanupResult> {
        const startTime = Date.now()

        // L1: 清理过期缓存
        const l1Cleaned = this.l1Cache.cleanExpired()

        // L2: 清理过期缓存
        const l2Cleaned = await this.l2Cache.cleanExpired()

        return {
            l1Cleaned,
            l2Cleaned,
            totalCleaned: l1Cleaned + l2Cleaned,
            duration: Date.now() - startTime,
            type: "expired"
        }
    }

    /**
     * 清理旧缓存
     * @param maxAge 最大年龄（毫秒）
     */
    async cleanOld(maxAge: number): Promise<CleanupResult> {
        const startTime = Date.now()
        const cutoffTime = Date.now() - maxAge

        // L1: 清理旧缓存
        const l1Cleaned = this.l1Cache.cleanByPredicate(
            entry => entry.createdAt < cutoffTime
        )

        // L2: 清理旧缓存
        const l2Cleaned = await this.l2Cache.cleanOld(maxAge)

        return {
            l1Cleaned,
            l2Cleaned,
            totalCleaned: l1Cleaned + l2Cleaned,
            duration: Date.now() - startTime,
            type: "old"
        }
    }

    /**
     * 清理低频缓存
     * @param minHitCount 最小命中次数
     */
    async cleanLowFrequency(minHitCount: number): Promise<CleanupResult> {
        const startTime = Date.now()

        // L1: 清理低频缓存
        const l1Cleaned = this.l1Cache.cleanByPredicate(
            entry => entry.hitCount < minHitCount
        )

        // L2: 清理低频缓存
        const l2Cleaned = await this.l2Cache.cleanLowFrequency(minHitCount)

        return {
            l1Cleaned,
            l2Cleaned,
            totalCleaned: l1Cleaned + l2Cleaned,
            duration: Date.now() - startTime,
            type: "lowFrequency"
        }
    }

    /**
     * 清理超容量缓存
     * @param maxSize 最大容量
     */
    async cleanOverCapacity(maxSize: number): Promise<CleanupResult> {
        const startTime = Date.now()

        // L1: 由 LRU 策略自动处理，不需要手动清理
        const l1Cleaned = 0

        // L2: 清理超容量缓存
        const l2Cleaned = await this.l2Cache.cleanOverCapacity(maxSize)

        return {
            l1Cleaned,
            l2Cleaned,
            totalCleaned: l1Cleaned + l2Cleaned,
            duration: Date.now() - startTime,
            type: "overCapacity"
        }
    }

    /**
     * 手动清理（根据选项）
     * @param options 清理选项
     */
    async manualClean(options: CleanupOptions = {}): Promise<CleanupResult> {
        const startTime = Date.now()
        let l1Cleaned = 0
        let l2Cleaned = 0

        // 清理过期缓存
        l1Cleaned += this.l1Cache.cleanExpired()
        l2Cleaned += await this.l2Cache.cleanExpired()

        // 清理旧缓存
        if (options.maxAge) {
            const cutoffTime = Date.now() - options.maxAge
            l1Cleaned += this.l1Cache.cleanByPredicate(
                entry => entry.createdAt < cutoffTime
            )
            l2Cleaned += await this.l2Cache.cleanOld(options.maxAge)
        }

        // 清理低频缓存
        if (options.minHitCount !== undefined) {
            l1Cleaned += this.l1Cache.cleanByPredicate(
                entry => entry.hitCount < options.minHitCount!
            )
            l2Cleaned += await this.l2Cache.cleanLowFrequency(
                options.minHitCount
            )
        }

        // 清理超容量缓存
        if (options.maxSize) {
            l2Cleaned += await this.l2Cache.cleanOverCapacity(options.maxSize)
        }

        return {
            l1Cleaned,
            l2Cleaned,
            totalCleaned: l1Cleaned + l2Cleaned,
            duration: Date.now() - startTime,
            type: "manual"
        }
    }

    /**
     * 清空所有缓存
     */
    async clearAll(): Promise<void> {
        this.l1Cache.clear()
        await this.l2Cache.clear()
    }

    /**
     * 更新配置
     * @param config 新配置
     */
    updateConfig(config: Partial<CleanupStrategyConfig>): void {
        this.config = {
            ...this.config,
            ...config
        }

        // 如果更改了启用状态或间隔，重启清理任务
        if (config.enabled !== undefined || config.interval !== undefined) {
            this.stop()
            if (this.config.enabled) {
                this.start()
            }
        }
    }

    /**
     * 获取当前配置
     */
    getConfig(): Required<CleanupStrategyConfig> {
        return { ...this.config }
    }
}
