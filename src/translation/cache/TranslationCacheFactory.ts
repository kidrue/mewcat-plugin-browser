/**
 * 翻译缓存工厂
 * 提供便捷的缓存实例创建方法
 */

import { STORAGE_NAMES } from "@/constants/storage"

import {
    TieredTranslationCache,
    type TieredCacheConfig
} from "./TieredTranslationCache"

/**
 * 预设配置类型
 */
export type CachePreset = "default" | "performance" | "storage" | "minimal"

/**
 * 预设配置映射
 */
const PRESET_CONFIGS: Record<CachePreset, TieredCacheConfig> = {
    // 默认配置：平衡性能和存储
    default: {
        l1Config: {
            maxSize: 1000,
            defaultTTL: 24 * 60 * 60 * 1000 // 24小时
        },
        l2Config: {
            dbName: STORAGE_NAMES.translationCacheDatabase,
            storeName: "translations",
            version: 1
        },
        cleanupConfig: {
            enabled: true,
            interval: 60 * 60 * 1000, // 1小时
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
            maxSize: 10000,
            minHitCount: 0
        },
        enableL2: true,
        defaultTTL: 7 * 24 * 60 * 60 * 1000 // 7天
    },

    // 性能优先：更大的内存缓存，更频繁的清理
    performance: {
        l1Config: {
            maxSize: 2000,
            defaultTTL: 12 * 60 * 60 * 1000 // 12小时
        },
        l2Config: {
            dbName: STORAGE_NAMES.translationCacheDatabase,
            storeName: "translations",
            version: 1
        },
        cleanupConfig: {
            enabled: true,
            interval: 30 * 60 * 1000, // 30分钟
            maxAge: 3 * 24 * 60 * 60 * 1000, // 3天
            maxSize: 5000,
            minHitCount: 1 // 清理未命中的缓存
        },
        enableL2: true,
        defaultTTL: 3 * 24 * 60 * 60 * 1000 // 3天
    },

    // 存储优先：更小的内存缓存，更长的持久化时间
    storage: {
        l1Config: {
            maxSize: 500,
            defaultTTL: 48 * 60 * 60 * 1000 // 48小时
        },
        l2Config: {
            dbName: STORAGE_NAMES.translationCacheDatabase,
            storeName: "translations",
            version: 1
        },
        cleanupConfig: {
            enabled: true,
            interval: 2 * 60 * 60 * 1000, // 2小时
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
            maxSize: 50000,
            minHitCount: 0
        },
        enableL2: true,
        defaultTTL: 30 * 24 * 60 * 60 * 1000 // 30天
    },

    // 最小配置：仅内存缓存，不持久化
    minimal: {
        l1Config: {
            maxSize: 500,
            defaultTTL: 60 * 60 * 1000 // 1小时
        },
        cleanupConfig: {
            enabled: false
        },
        enableL2: false,
        defaultTTL: 60 * 60 * 1000 // 1小时
    }
}

/**
 * 缓存工厂类
 */
export class TranslationCacheFactory {
    /**
     * 创建缓存实例（使用预设配置）
     * @param preset 预设配置类型
     * @returns 缓存实例
     */
    static createFromPreset(preset: CachePreset): TieredTranslationCache {
        const config = PRESET_CONFIGS[preset]
        return new TieredTranslationCache(config)
    }

    /**
     * 创建缓存实例（使用自定义配置）
     * @param config 自定义配置
     * @returns 缓存实例
     */
    static create(config: TieredCacheConfig): TieredTranslationCache {
        return new TieredTranslationCache(config)
    }

    /**
     * 创建缓存实例（基于预设配置并覆盖部分选项）
     * @param preset 预设配置类型
     * @param overrides 覆盖配置
     * @returns 缓存实例
     */
    static createWithOverrides(
        preset: CachePreset,
        overrides: Partial<TieredCacheConfig>
    ): TieredTranslationCache {
        const baseConfig = PRESET_CONFIGS[preset]
        const mergedConfig: TieredCacheConfig = {
            ...baseConfig,
            ...overrides,
            l1Config: {
                ...baseConfig.l1Config,
                ...overrides.l1Config
            },
            l2Config: {
                ...baseConfig.l2Config,
                ...overrides.l2Config
            },
            cleanupConfig: {
                ...baseConfig.cleanupConfig,
                ...overrides.cleanupConfig
            }
        }
        return new TieredTranslationCache(mergedConfig)
    }

    /**
     * 获取预设配置
     * @param preset 预设配置类型
     * @returns 配置对象
     */
    static getPresetConfig(preset: CachePreset): TieredCacheConfig {
        return { ...PRESET_CONFIGS[preset] }
    }

    /**
     * 获取所有可用的预设
     * @returns 预设列表
     */
    static getAvailablePresets(): CachePreset[] {
        return Object.keys(PRESET_CONFIGS) as CachePreset[]
    }
}

/**
 * 便捷函数：创建默认缓存实例
 */
export function createDefaultCache(): TieredTranslationCache {
    return TranslationCacheFactory.createFromPreset("default")
}

/**
 * 便捷函数：创建性能优先缓存实例
 */
export function createPerformanceCache(): TieredTranslationCache {
    return TranslationCacheFactory.createFromPreset("performance")
}

/**
 * 便捷函数：创建存储优先缓存实例
 */
export function createStorageCache(): TieredTranslationCache {
    return TranslationCacheFactory.createFromPreset("storage")
}

/**
 * 便捷函数：创建最小缓存实例
 */
export function createMinimalCache(): TieredTranslationCache {
    return TranslationCacheFactory.createFromPreset("minimal")
}
