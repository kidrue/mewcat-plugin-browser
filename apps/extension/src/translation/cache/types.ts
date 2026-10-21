/**
 * 翻译缓存类型定义
 */

/**
 * 缓存键参数
 */
export interface CacheKeyParams {
    /** 原文文本 */
    text: string
    /** 源语言 */
    sourceLang: string
    /** 目标语言 */
    targetLang: string
    /** 模型ID */
    modelId: string | number
    /** AI角色 */
    aiRole?: string
    /** 上下文标识（可选） */
    context?: string
}

/**
 * 缓存条目
 */
export interface CacheEntry {
    /** 缓存键 */
    key: string
    /** 原文文本 */
    text: string
    /** 翻译结果 */
    translation: string
    /** 源语言 */
    sourceLang: string
    /** 目标语言 */
    targetLang: string
    /** 模型ID */
    modelId: string | number
    /** AI角色 */
    aiRole: string
    /** 上下文标识 */
    context?: string
    /** 创建时间 */
    createdAt: number
    /** 最后访问时间 */
    lastAccessTime: number
    /** 过期时间（null表示永不过期） */
    expiresAt: number | null
    /** 命中次数 */
    hitCount: number
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
    /** 缓存条目数量 */
    size: number
    /** 总命中次数 */
    totalHits: number
    /** 预估内存占用 */
    estimatedMemory: string
    /** 平均命中率 */
    hitRate: number
    /** L1缓存大小 */
    l1Size?: number
    /** L2缓存大小 */
    l2Size?: number
}

/**
 * 缓存清理选项
 */
export interface CleanupOptions {
    /** 最大缓存年龄（毫秒） */
    maxAge?: number
    /** 最大缓存条目数 */
    maxSize?: number
    /** 最小命中次数 */
    minHitCount?: number
}

/**
 * 文本模板提取结果
 */
export interface TemplateExtractionResult {
    /** 模板文本 */
    template: string
    /** 变量列表 */
    variables: string[]
    /** 是否包含变量 */
    hasVariables: boolean
}
