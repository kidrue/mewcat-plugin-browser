import type { TokenCounts } from "./types"

const asTokenInteger = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
        ? Math.round(value)
        : undefined

const readNumber = (
    value: Record<string, unknown>,
    keys: string[]
): number | undefined => {
    for (const key of keys) {
        const normalized = asTokenInteger(value[key])
        if (normalized !== undefined) {
            return normalized
        }
    }
    return undefined
}

export function estimateTokenCount(text: string): number {
    const compact = text.trim()
    if (!compact) {
        return 0
    }
    const cjkCount = (compact.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? [])
        .length
    const remaining = compact.replace(
        /[\u3400-\u9fff\uf900-\ufaff\s]/g,
        ""
    ).length
    return cjkCount + Math.ceil(remaining / 4)
}

export function normalizeReportedUsage(
    value: unknown
): TokenCounts | undefined {
    if (!value || typeof value !== "object") {
        return undefined
    }
    const usage = value as Record<string, unknown>
    const inputTokens = readNumber(usage, [
        "inputTokens",
        "promptTokens",
        "prompt_tokens"
    ])
    const outputTokens = readNumber(usage, [
        "outputTokens",
        "completionTokens",
        "completion_tokens"
    ])
    if (inputTokens === undefined || outputTokens === undefined) {
        return undefined
    }
    const reportedTotal = readNumber(usage, ["totalTokens", "total_tokens"])
    return {
        inputTokens,
        outputTokens,
        totalTokens: reportedTotal ?? inputTokens + outputTokens
    }
}

export function estimateUsage(input: string, output: string): TokenCounts {
    const inputTokens = estimateTokenCount(input)
    const outputTokens = estimateTokenCount(output)
    return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
    }
}
