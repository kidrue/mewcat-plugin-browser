export const EXPLAIN_MARKER = "[EXPLAIN]"
export const TRANSLATE_MARKER = "[TRANSLATE]"
export const TRANSLATION_MARKER = "[TRANSLATION]"
export const TERMS_MARKER = "[TERMS]"

const controlMarkers = [
    EXPLAIN_MARKER,
    TRANSLATE_MARKER,
    TRANSLATION_MARKER,
    TERMS_MARKER
]

function bufferControlMarker(text: string): string {
    const lastLine = text.slice(text.lastIndexOf("\n") + 1).trim()
    return lastLine &&
        controlMarkers.some(marker => marker.startsWith(lastLine))
        ? text.slice(0, text.lastIndexOf(lastLine)).trim()
        : text.trim()
}

export type SelectionAnalysis =
    | { mode: "pending" }
    | { mode: "translate" }
    | { mode: "explain"; value: string; explanation: string }

/** 缓冲不完整的控制标记，完整响应必须同时包含译文和概念解释。 */
export function parseSelectionAnalysis(
    text: string,
    complete = false
): SelectionAnalysis {
    const normalized = text.replace(/\r\n/g, "\n").trimStart()
    const newline = normalized.indexOf("\n")
    const header = (
        newline < 0 ? normalized : normalized.slice(0, newline)
    ).trim()
    const body = newline < 0 ? "" : normalized.slice(newline + 1).trim()

    if (header === EXPLAIN_MARKER) {
        const translationHeaderEnd = body.indexOf("\n")
        if (body.slice(0, translationHeaderEnd).trim() === TRANSLATION_MARKER) {
            const content = body.slice(translationHeaderEnd + 1)
            const terms = /(?:^|\n)\[TERMS\](?:\n|$)/.exec(content)
            if (terms) {
                const value = content.slice(0, terms.index).trim()
                const explanation = content
                    .slice(terms.index + terms[0].length)
                    .trim()
                if (
                    !controlMarkers.some(
                        marker =>
                            value.includes(marker) ||
                            explanation.includes(marker)
                    ) &&
                    (!complete || (value && explanation))
                ) {
                    return {
                        mode: "explain",
                        value,
                        explanation: complete
                            ? explanation
                            : bufferControlMarker(explanation)
                    }
                }
            } else if (!complete) {
                // 暂存最后一行可能尚未传完的栏目标记。
                const value = bufferControlMarker(content)
                if (!controlMarkers.some(marker => value.includes(marker)))
                    return { mode: "explain", value, explanation: "" }
            }
        }
    }
    if (header === TRANSLATE_MARKER && !body) {
        return { mode: "translate" }
    }
    if (complete) throw new Error("Invalid selection analysis response")
    return { mode: "pending" }
}
