export function getStringByteLength(str: string) {
    // 使用UTF-8编码计算字节长度
    return new TextEncoder().encode(str).length
}

/**
 * 获取用户当前在页面中选中的文本
 * @returns 选中的文本（若未选中则返回空字符串）
 */
export function getSelectedText(): string {
    // 检查浏览器是否支持 window.getSelection()
    if (typeof window.getSelection !== "function") {
        return ""
    }

    // 获取 Selection 对象
    const selection = window.getSelection()

    // 若没有选中内容，返回空字符串
    if (!selection || selection.rangeCount === 0) {
        return ""
    }

    // 返回选中的文本
    return selection.toString().trim()
}

export function matchUrlPattern(pattern: string, url: string): boolean {
    if (!pattern || !url) {
        return false
    }
    const reg = new RegExp(pattern.includes("http") ? pattern : `/${pattern}`)
    // 精确匹配或前缀匹配
    return reg.test(url)
}

export function matchUrlPatternList(pattern: string[], url: string): boolean {
    if (pattern.length === 0 || !url) {
        return false
    }
    // 精确匹配或前缀匹配
    return pattern.some(pattern => {
        return matchUrlPattern(pattern, url)
    })
}

/**
 * 获取元素的可翻译文本内容
 * 处理特殊元素的属性文本和文本节点遍历
 */
export function getElementText(element: Element): string {
    // 对于某些特殊元素，获取特定属性的文本
    if (element.matches("input[placeholder]")) {
        return element.getAttribute("placeholder") || ""
    }
    if (element.matches("textarea[placeholder]")) {
        return element.getAttribute("placeholder") || ""
    }
    if (element.matches("img[alt]")) {
        return element.getAttribute("alt") || ""
    }

    // 获取直接文本内容，排除子元素的文本
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
            const parent = node.parentElement
            if (!parent) {
                return NodeFilter.FILTER_REJECT
            }

            // 排除代码、脚本等元素的文本
            if (parent.matches("code, pre, script, style, noscript")) {
                return NodeFilter.FILTER_REJECT
            }

            return NodeFilter.FILTER_ACCEPT
        }
    })

    const textParts: string[] = []
    let node: Node | null
    while ((node = walker.nextNode())) {
        const text = node.textContent?.trim()
        if (text && text.length > 0) {
            textParts.push(text)
        }
    }

    return textParts.join(" ").trim()
}

/**
 * 标准化分割翻译结果
 * 处理 AI 可能返回的各种分隔符格式变体
 *
 * @param translationResults - AI 返回的翻译结果字符串
 * @param expectedCount - 期望的段落数量（用于验证）
 * @returns 分割后的翻译段落数组
 */
export function splitTranslationResults(
    translationResults: string,
    expectedCount?: number
): string[] {
    // 首先尝试标准格式：\n\n%%\n\n
    if (translationResults.includes("\n\n%%\n\n")) {
        const result = translationResults.split("\n\n%%\n\n")

        // 验证段落数量
        if (expectedCount && result.length !== expectedCount) {
            console.warn(
                `⚠️ 翻译段落数量不匹配！期望 ${expectedCount} 个，实际返回 ${result.length} 个`,
                {
                    expected: expectedCount,
                    actual: result.length,
                    translationResults:
                        translationResults.substring(0, 500) + "..."
                }
            )
        }

        return result
    }

    // 处理 AI 可能返回的双空行分割（将其规范化）
    // 注意：这里先替换 4 个换行符（双空行）为标准分隔符
    const normalized = translationResults.replaceAll("\n\n\n\n", "\n\n%%\n\n")

    // 再次尝试标准格式
    if (normalized.includes("\n\n%%\n\n")) {
        const result = normalized.split("\n\n%%\n\n")

        // 验证段落数量
        if (expectedCount && result.length !== expectedCount) {
            console.warn(
                `⚠️ 翻译段落数量不匹配（已规范化）！期望 ${expectedCount} 个，实际返回 ${result.length} 个`,
                {
                    expected: expectedCount,
                    actual: result.length,
                    translationResults: normalized.substring(0, 500) + "..."
                }
            )
        }

        return result
    }

    // 如果仍然没有分隔符，可能只有一个段落
    if (expectedCount && expectedCount > 1) {
        console.error(
            `❌ 严重错误：无法找到分隔符 %%，但期望有 ${expectedCount} 个段落！`,
            {
                translationResults: translationResults.substring(0, 500) + "..."
            }
        )
    }

    return [translationResults]
}

export function parseErrorString(errStr: string): {
    errorType: string
    errorDetails: string
} {
    // 尝试从错误字符串中提取类型和详情
    const match = errStr.match(/^(.*?)[:：](.+)$/)
    if (match) {
        return {
            errorType: match[1].trim(),
            errorDetails: match[2].trim()
        }
    }
    // 如果无法提取，使用默认格式
    return {
        errorType: "翻译错误",
        errorDetails: errStr
    }
}
