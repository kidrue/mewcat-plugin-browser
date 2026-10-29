export const EXPLAIN_MARKER = "[EXPLAIN]"
export const TRANSLATE_MARKER = "[TRANSLATE]"

export type SelectionAnalysis =
    | { mode: "pending" }
    | { mode: "translate" }
    | { mode: "explain"; value: string }

/** 缓冲不完整的首行，控制标记永远不进入展示或复制内容。 */
export function parseSelectionAnalysis(
    text: string,
    complete = false
): SelectionAnalysis {
    const normalized = text.trimStart()
    const newline = normalized.indexOf("\n")
    const header = (
        newline < 0 ? normalized : normalized.slice(0, newline)
    ).trim()
    const body = newline < 0 ? "" : normalized.slice(newline + 1).trim()

    if (header === EXPLAIN_MARKER && (body || !complete)) {
        return { mode: "explain", value: body }
    }
    if (header === TRANSLATE_MARKER && !body) {
        return { mode: "translate" }
    }
    if (complete) throw new Error("Invalid selection analysis response")
    return { mode: "pending" }
}
