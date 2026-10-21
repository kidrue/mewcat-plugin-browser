/**
 * 缓存键生成器
 * 负责生成标准化的缓存键
 */

import {
    extractTextTemplate,
    hashText,
    hashTextSync,
    normalizeText
} from "./textNormalizer"
import type { CacheKeyParams } from "./types"

/**
 * 生成缓存键（异步版本，使用 SHA-256）
 * 格式: sourceLang|targetLang|textHash|modelId|aiRole|context
 * 推荐用于持久化缓存等异步场景，哈希质量最高
 * @param params 缓存键参数
 * @returns 标准化的缓存键
 */
export async function generateCacheKey(
    params: CacheKeyParams
): Promise<string> {
    const {
        text,
        sourceLang,
        targetLang,
        modelId,
        aiRole = "default",
        context = ""
    } = params

    // 1. 规范化文本
    const normalizedText = normalizeText(text)

    // 2. 提取模板（处理动态文本）
    const { template, hasVariables } = extractTextTemplate(normalizedText)

    // 3. 使用模板或原文本
    const keyText = hasVariables ? template : normalizedText

    // 4. 对长文本使用哈希，短文本直接使用
    const textKey = keyText.length > 100 ? await hashText(keyText) : keyText

    // 5. 组合生成键
    const parts = [
        sourceLang.toLowerCase(),
        targetLang.toLowerCase(),
        textKey,
        String(modelId),
        aiRole,
        context
    ]

    return parts.join("|")
}

/**
 * 生成缓存键（同步版本，使用改进的 FNV-1a）
 * 格式: sourceLang|targetLang|textHash|modelId|aiRole|context
 * 推荐用于内存缓存等同步场景，性能最优
 * @param params 缓存键参数
 * @returns 标准化的缓存键
 */
export function generateCacheKeySync(params: CacheKeyParams): string {
    const {
        text,
        sourceLang,
        targetLang,
        modelId,
        aiRole = "default",
        context = ""
    } = params

    // 1. 规范化文本
    const normalizedText = normalizeText(text)

    // 2. 提取模板（处理动态文本）
    const { template, hasVariables } = extractTextTemplate(normalizedText)

    // 3. 使用模板或原文本
    const keyText = hasVariables ? template : normalizedText

    // 4. 对长文本使用哈希，短文本直接使用
    const textKey = keyText.length > 100 ? hashTextSync(keyText) : keyText

    // 5. 组合生成键
    const parts = [
        sourceLang.toLowerCase(),
        targetLang.toLowerCase(),
        textKey,
        String(modelId),
        aiRole,
        context
    ]

    return parts.join("|")
}

/**
 * 解析缓存键
 * @param key 缓存键
 * @returns 解析后的参数对象
 */
export function parseCacheKey(key: string): {
    sourceLang: string
    targetLang: string
    textKey: string
    modelId: string
    aiRole: string
    context: string
} {
    const parts = key.split("|")

    return {
        sourceLang: parts[0] || "",
        targetLang: parts[1] || "",
        textKey: parts[2] || "",
        modelId: parts[3] || "",
        aiRole: parts[4] || "default",
        context: parts[5] || ""
    }
}

/**
 * 检查两个缓存键是否匹配（忽略某些字段）
 * @param key1 缓存键1
 * @param key2 缓存键2
 * @param ignoreFields 要忽略的字段
 * @returns 是否匹配
 */
export function matchCacheKey(
    key1: string,
    key2: string,
    ignoreFields: Array<
        "sourceLang" | "targetLang" | "modelId" | "aiRole" | "context"
    > = []
): boolean {
    const parsed1 = parseCacheKey(key1)
    const parsed2 = parseCacheKey(key2)

    const fields: Array<keyof typeof parsed1> = [
        "sourceLang",
        "targetLang",
        "textKey",
        "modelId",
        "aiRole",
        "context"
    ]

    for (const field of fields) {
        if (ignoreFields.includes(field as never)) {
            continue
        }
        if (parsed1[field] !== parsed2[field]) {
            return false
        }
    }

    return true
}
