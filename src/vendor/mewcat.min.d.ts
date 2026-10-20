export interface MewCatClientState {
    identity: { signing: CryptoKeyPair; encryption: CryptoKeyPair }
    clientId?: string
}

export interface MewCatRequestOptions {
    signal?: AbortSignal
    timeoutMs?: number
}

export interface MewCatTranslationClient {
    getState(): MewCatClientState
    register(name?: string, options?: MewCatRequestOptions): Promise<string>
    translate(
        input: {
            texts: string[]
            targetLanguage: string
            sourceLanguage?: string
        },
        options?: MewCatRequestOptions
    ): Promise<{ translations: string[] }>
    submitFeedback(
        input: {
            message: string
            replyEmail?: string
            extensionVersion: string
        },
        options?: MewCatRequestOptions
    ): Promise<{ accepted: true }>
}

export class TranslationError extends Error {
    readonly code: string
    readonly status: number
}

export declare const TranslationClient: {
    connect(options: {
        baseUrl: string
        state?: MewCatClientState
        fetcher?: typeof fetch
        pinnedSigningThumbprint?: string
        timeoutMs?: number
        signal?: AbortSignal
    }): Promise<MewCatTranslationClient>
}

export function loadClientState(
    serviceOrigin: string
): Promise<MewCatClientState | undefined>
export function saveClientState(
    serviceOrigin: string,
    state: MewCatClientState
): Promise<void>
