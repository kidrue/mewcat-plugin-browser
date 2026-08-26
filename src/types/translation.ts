import type { AiRole } from "./config"

export interface Message {
    content: string
    id?: string
    role: "assistant" | "user" | "system" | string
}

export interface TranslatorConfig {
    apiKey: string
    model: string
    baseUrl?: string
    aiRole: AiRole
}

export interface TranslatorInterface {
    readonly provider: string
    translateText(messages: Message[], targetLang: string): Promise<string>
    translateBatch(messages: Message[], targetLang: string): Promise<string>
    checkConnection(): Promise<boolean>
    abortAllTranslations(): void
}

export interface Choice {
    finish_reason: "stop" | "length" | "content_filter" | string
    index: number
    logprobs?: null | unknown
    message: Message
}

export interface Usage {
    completion_tokens: number
    prompt_tokens: number
    total_tokens: number
    prompt_tokens_details?: {
        cached_tokens?: number
    }
    completion_tokens_details?: {
        reasoning_tokens?: number
    }
}

export interface AIModelResponse {
    choices: Choice[]
    created: number
    id: string
    model: string
    object: "chat.completion" | string
    usage: Usage
    service_tier?: "default" | string
    system_fingerprint?: string
}

export interface AIModelRequest {
    temperature?: number
    max_tokens?: number
    model: string | number
    baseUrl: string
    endpoint?: string
    messages: Message[]
}

export enum GEMINI_ThinkingLevel {
    /**
     * Unspecified thinking level.
     */
    THINKING_LEVEL_UNSPECIFIED = "THINKING_LEVEL_UNSPECIFIED",
    /**
     * Low thinking level.
     */
    LOW = "LOW",
    /**
     * Medium thinking level.
     */
    MEDIUM = "MEDIUM",
    /**
     * High thinking level.
     */
    HIGH = "HIGH",
    /**
     * MINIMAL thinking level.
     */
    MINIMAL = "MINIMAL"
}
