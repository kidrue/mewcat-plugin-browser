export function normalizeSummaryResult(value: string): string {
    const plain = value
        .replace(/<[^>]*>/g, "")
        .replace(/[*_`#]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    if (!plain) return ""
    const firstSentence =
        plain.match(/^(.+?[。！？.!?](?:\s|$)|.+$)/)?.[1] ?? plain
    return firstSentence.trim().slice(0, 300)
}
