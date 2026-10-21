/**
 * 翻译缓存模块导出
 */

// 类型定义
export type {
    CacheKeyParams,
    CacheEntry,
    CacheStats,
    CleanupOptions,
    TemplateExtractionResult
} from "./types"

// 文本规范化工具
export {
    normalizeText,
    extractFingerprint,
    calculateSimilarity,
    extractTextTemplate,
    restoreTextFromTemplate,
    hashText,
    hashTextSync,
    isDynamicText
} from "./textNormalizer"

// 缓存键生成器
export {
    generateCacheKey,
    generateCacheKeySync,
    parseCacheKey,
    matchCacheKey
} from "./cacheKeyGenerator"

// L1 内存缓存
export { L1MemoryCache, type L1CacheConfig } from "./L1MemoryCache"

// L2 持久化缓存
export { L2PersistentCache, type L2CacheConfig } from "./L2PersistentCache"

// 缓存清理管理器
export {
    CacheCleanupManager,
    type CleanupStrategyConfig,
    type CleanupResult
} from "./CacheCleanupManager"

// 分层缓存管理器
export {
    TieredTranslationCache,
    type TieredCacheConfig
} from "./TieredTranslationCache"

// 缓存工厂
export {
    TranslationCacheFactory,
    type CachePreset,
    createDefaultCache,
    createPerformanceCache,
    createStorageCache,
    createMinimalCache
} from "./TranslationCacheFactory"
