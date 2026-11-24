import type {
    ClientState,
    RequestOptions,
    TranslationClient
} from "./client.js"

export * from "./client.js"
export * from "./storage.js"
export {
    CHAT_COMPLETIONS_MAX_INPUT,
    chatCompletionInputSchema,
    analyticsQuerySchema,
    analyticsResultSchema,
    analyticsRoutes
} from "@mewcat/protocol"
export type {
    ChatCompletionInput,
    ChatCompletionResult,
    AnalyticsInput,
    AnalyticsResult,
    AnalyticsOverview,
    AnalyticsDevices,
    AnalyticsProfile,
    AnalyticsCalls
} from "@mewcat/protocol"

export type MewCatClientState = ClientState
export type MewCatRequestOptions = RequestOptions
export type MewCatTranslationClient = Pick<
    TranslationClient,
    "getState" | "register" | "translate" | "submitFeedback" | "chatCompletions"
> &
    Partial<Pick<TranslationClient, "queryAnalytics">>
