export const TOKEN_USAGE_FEATURES = [
    "page-translation",
    "selection-translation",
    "concept-explanation",
    "page-summary",
    "image-translation"
] as const

export type TokenUsageFeature = (typeof TOKEN_USAGE_FEATURES)[number]
export type TokenUsageSource = "estimated" | "reported"

export interface TokenCounts {
    inputTokens: number
    outputTokens: number
    totalTokens: number
}

export interface TokenUsageEvent {
    date?: string
    modelId: string
    modelName: string
    feature: TokenUsageFeature
    source: TokenUsageSource
    counts: TokenCounts
}

export interface TokenUsageEntry extends TokenCounts {
    date: string
    modelId: string
    modelName: string
    feature: TokenUsageFeature
    source: TokenUsageSource
    requestCount: number
}

export interface TokenUsageStore {
    version: 1
    entries: TokenUsageEntry[]
}
