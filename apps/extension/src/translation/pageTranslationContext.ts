import { extractPageContent } from "@/page-summary/pageContent"

import { EDITABLE_SELECTOR } from "./paragraphTarget"

const MAX_CONTEXT_LENGTH = 2000

export function normalizeTranslationContext(
    context?: string
): string | undefined {
    const limited = context
        ?.trim()
        .slice(0, MAX_CONTEXT_LENGTH)
        .replace(/[\uD800-\uDBFF]$/u, "")
    return limited || undefined
}

/** 只提取原文，避免把已生成的译文、提示层和编辑内容作为上下文。 */
export function extractTranslationContext(
    document: Document
): string | undefined {
    const snapshot = document.cloneNode(true) as Document
    snapshot
        .querySelectorAll(
            `${EDITABLE_SELECTOR},script,style,noscript,template,.mewcat-container,.mewcat-page-summary,#translation-control-center-overlay,mewcat-selection-translate,mewcat-image-translate,[data-mewcat-paragraph-preview]`
        )
        .forEach(element => element.remove())
    const { title, text } = extractPageContent(snapshot)
    return normalizeTranslationContext(
        [title, text].filter(Boolean).join("\n\n")
    )
}
