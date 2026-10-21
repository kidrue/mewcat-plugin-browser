import type {
    ClientState,
    RequestOptions,
    TranslationClient
} from "./client.js"

export * from "./client.js"
export * from "./storage.js"

export type MewCatClientState = ClientState
export type MewCatRequestOptions = RequestOptions
export type MewCatTranslationClient = Pick<
    TranslationClient,
    "getState" | "register" | "translate" | "submitFeedback"
>
