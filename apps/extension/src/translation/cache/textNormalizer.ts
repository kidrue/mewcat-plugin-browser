/**
 * 文本规范化工具
 * 提供文本标准化、指纹提取、相似度计算等功能
 */

import type { TemplateExtractionResult } from "./types"

/**
 * 规范化文本，提高缓存命中率
 * @param text 原始文本
 * @returns 规范化后的文本
 */
export function normalizeText(text: string): string {
    return (
        text
            .trim()
            // 统一空白字符
            .replace(/\s+/g, " ")
            // 统一引号
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            // 移除零宽字符
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            // 统一换行符
            .replace(/\r\n/g, "\n")
    )
}

/**
 * 提取文本指纹（用于相似度匹配）
 * @param text 原始文本
 * @returns 文本指纹
 */
export function extractFingerprint(text: string): string {
    return normalizeText(text)
        .toLowerCase()
        .replace(/[^\w\s]/g, "") // 移除标点
        .split(/\s+/)
        .filter(Boolean) // 移除空字符串
        .sort()
        .join(" ")
}

/**
 * 计算两个文本的相似度（Jaccard相似度）
 * @param text1 文本1
 * @param text2 文本2
 * @returns 相似度分数 (0-1)
 */
export function calculateSimilarity(text1: string, text2: string): number {
    const fp1 = extractFingerprint(text1)
    const fp2 = extractFingerprint(text2)

    if (fp1 === fp2) {
        return 1.0
    }

    // 简单的 Jaccard 相似度
    const set1 = new Set(fp1.split(" "))
    const set2 = new Set(fp2.split(" "))

    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return union.size === 0 ? 0 : intersection.size / union.size
}

/**
 * 提取动态文本模板（替换变量为占位符）
 * 支持识别：数字、花括号变量、百分比、货币符号等
 * @param text 带变量的文本（如"您有3条消息"）
 * @returns 模板提取结果
 */
export function extractTextTemplate(text: string): TemplateExtractionResult {
    const variables: string[] = []
    let placeholderIndex = 0

    // 匹配模式（按优先级）：
    // 1. 花括号变量：{variable}
    // 2. 数字（包括小数、负数）：123, -45.67
    // 3. 百分比：50%
    // 4. 货币：$100, ¥200, €50
    const template = text.replace(
        /\{[^}]+\}|-?\d+\.?\d*%?|[$¥€£]\s*-?\d+\.?\d*/g,
        match => {
            variables.push(match)
            return `{${placeholderIndex++}}`
        }
    )
    return {
        template,
        variables,
        hasVariables: variables.length > 0
    }
}

/**
 * 将模板和变量还原为原始文本
 * @param template 模板文本
 * @param variables 变量列表
 * @returns 还原后的文本
 */
export function restoreTextFromTemplate(
    template: string,
    variables: string[]
): string {
    let result = template
    variables.forEach((variable, index) => {
        result = result.replace(`{${index}}`, variable)
    })
    return result
}

/**
 * SHA-256 哈希函数（用于长文本）
 * 使用 Web Crypto API 生成高质量哈希，碰撞概率极低
 * @param text 文本
 * @returns 哈希值（十六进制字符串，前16位）
 */
export async function hashText(text: string): Promise<string> {
    // 将文本转换为 Uint8Array
    const encoder = new TextEncoder()
    const data = encoder.encode(text)

    // 使用 SHA-256 计算哈希
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)

    // 转换为十六进制字符串
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("")

    // 返回前16个字符（64位熵，碰撞概率约为 1/2^64）
    // 如果需要更高安全性，可以返回完整的 64 个字符
    return hashHex.slice(0, 16)
}

/**
 * 同步哈希函数（备用方案，用于不支持 async 的场景）
 * 使用改进的 FNV-1a 算法，比原来的简单哈希更好
 * @param text 文本
 * @returns 哈希值（十六进制字符串）
 */
export function hashTextSync(text: string): string {
    // FNV-1a 哈希算法（64位模拟）
    let h1 = 0x811c9dc5 // FNV offset basis (32-bit)
    let h2 = 0x1000193 // FNV prime (32-bit)

    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i)
        // 混合两个 32 位哈希以模拟 64 位
        h1 ^= char
        h1 = Math.imul(h1, h2)
        h2 ^= char >> 8
        h2 = Math.imul(h2, 0x1000193)
    }

    // 组合两个哈希值并转换为十六进制
    const combined = ((h1 >>> 0) * 0x100000000 + (h2 >>> 0)).toString(16)
    return combined.padStart(16, "0")
}

/**
 * 检测文本是否为动态内容（包含变量）
 * @param text 文本
 * @returns 是否为动态内容
 */
export function isDynamicText(text: string): boolean {
    const result = extractTextTemplate(text)
    return result.hasVariables
}
