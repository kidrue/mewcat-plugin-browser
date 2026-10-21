/**
 * 单词数统计配置项
 */
interface WordCountOptions {
    // 允许的单词特殊字符（默认支持撇号、连字符，用于don't、mother-in-law等合法单词）
    allowedSpecialChars?: string[]
    // 是否区分大小写（默认false，统一转为小写统计，避免Hello/hello算两个单词）
    caseSensitive?: boolean
}

/**
 * 单词数统计结果
 */
interface WordCountResult {
    // 总单词数
    total: number
    // 提取出的单词列表（去重/不去重可选，默认不去重）
    words: string[]
    // 去重后的单词列表（可选）
    uniqueWords?: string[]
}

/**
 * 统计文本中的单词数量
 * @param text 待统计的文本
 * @param options 配置项（可选）
 * @returns 统计结果（总单词数+单词列表）
 */
export function getCountWords(
    text: string,
    options: WordCountOptions = {}
): WordCountResult {
    // 处理默认配置
    const { allowedSpecialChars = ["'", "-"], caseSensitive = false } = options

    // 空文本直接返回0
    if (!text.trim()) {
        return { total: 0, words: [], uniqueWords: [] }
    }

    // 步骤1：统一文本格式（转小写/保留大小写 + 替换换行/制表符为空格）
    const normalizedText = caseSensitive
        ? text.replace(/[\t\n\r]/g, " ")
        : text.toLowerCase().replace(/[\t\n\r]/g, " ")

    // 步骤2：构建合法字符正则（字母 + 允许的特殊字符）
    // 转义特殊字符（比如-在正则中需要转义）
    const escapedSpecialChars = allowedSpecialChars
        .map(char => (/[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char))
        .join("")
    // 正则规则：至少1个字母开头 → 中间可跟字母/特殊字符 → 至少1个字母结尾（避免纯特殊字符被统计）
    const wordRegex = new RegExp(
        `[a-zA-Z]+[a-zA-Z${escapedSpecialChars}]*[a-zA-Z]+`,
        "g"
    )

    // 步骤3：提取所有合法单词
    const words = normalizedText.match(wordRegex) || []

    // 步骤4：去重（可选）
    const uniqueWords = Array.from(new Set(words))

    // 返回统计结果
    return {
        total: words.length,
        words,
        uniqueWords
    }
}
