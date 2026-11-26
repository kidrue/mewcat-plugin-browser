// cspell:words opencc
import { franc } from "franc"
import { CustomConverter } from "opencc-js/core"
import simplifiedToTraditional from "opencc-js/dict/STCharacters"
import traditionalToSimplified from "opencc-js/dict/TSCharacters"

import { francToI18nMap } from "@/utils/francLanguageMap"

// 只加载字形字典进行判断，不引入完整词组转换器，也不改写网页内容。
const toSimplified = CustomConverter(traditionalToSimplified)
const toTraditional = CustomConverter(simplifiedToTraditional)

/** 仅在文本语言明确时跳过；混合段落和不确定的短文本仍交给翻译器。 */
export function isTargetLanguageText(
    text: string,
    targetLanguage?: string,
    declaredLanguage?: string
): boolean {
    if (!targetLanguage) {
        return false
    }
    const hasChinese = /\p{Script=Han}/u.test(text)
    if (targetLanguage.startsWith("zh")) {
        if (/^(ja|ko)(-|$)/i.test(declaredLanguage ?? "")) {
            return false
        }
        // 链接、强调等包装由调用方剥离；保留包含其他语言文字的段落。
        if (
            !hasChinese ||
            /[^\p{Script=Han}\p{P}\p{N}\p{Z}\p{S}\p{M}\p{Cf}\s]/u.test(text)
        ) {
            return false
        }
        if (targetLanguage === "zh-CN") {
            return toSimplified(text) === text
        }
        if (targetLanguage === "zh-TW") {
            return toTraditional(text) === text
        }
        return targetLanguage === "zh"
    }
    if (text.length < 30) {
        return false
    }
    const language = francToI18nMap.get(franc(text, { minLength: 30 }))
    // 中文夹杂英文时，即使英文占比高也不能漏掉中文部分。
    if (hasChinese && language !== "ja") {
        return false
    }
    return language === targetLanguage
}
