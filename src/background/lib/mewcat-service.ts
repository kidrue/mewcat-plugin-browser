import {
    MEWCAT_SERVICE_ORIGIN,
    MEWCAT_SIGNING_THUMBPRINT,
    MEWCAT_TRANSLATE_TIMEOUT_MS
} from "@/constants/translationServices"
import * as bundledSdk from "@/vendor/mewcat.min.js"
import type {
    MewCatClientState,
    MewCatRequestOptions,
    MewCatTranslationClient
} from "@/vendor/mewcat.min.js"

export interface MewCatTranslateInput {
    texts: string[]
    targetLanguage: string
    sourceLanguage?: string
    timeoutMs?: number
}

export interface MewCatSdkAdapter {
    TranslationClient: {
        connect(options: {
            baseUrl: string
            state?: MewCatClientState
            fetcher?: typeof fetch
            pinnedSigningThumbprint?: string
            timeoutMs?: number
            signal?: AbortSignal
        }): Promise<MewCatTranslationClient>
    }
    loadClientState(
        serviceOrigin: string
    ): Promise<MewCatClientState | undefined>
    saveClientState(
        serviceOrigin: string,
        state: MewCatClientState
    ): Promise<void>
}

interface MewCatServiceDependencies {
    sdk?: MewCatSdkAdapter
    fetchImpl?: typeof fetch
}

const ERROR_MESSAGES: Record<string, string> = {
    QUOTA_EXCEEDED: "今日免费翻译额度已用完",
    RATE_LIMITED: "请求过于频繁，请稍后重试",
    CLIENT_REVOKED: "当前设备已被停用",
    SERVER_BUSY: "免费翻译服务繁忙，请稍后重试",
    UPSTREAM_UNAVAILABLE: "免费翻译服务暂时不可用",
    UPSTREAM_INVALID_RESPONSE: "免费翻译服务返回了无效结果",
    UPSTREAM_TIMEOUT: "免费翻译服务响应超时",
    KEYS_UNAVAILABLE: "无法连接免费翻译服务",
    REQUEST_REJECTED: "无法连接免费翻译服务"
}

class ManualAbortError extends Error {
    constructor() {
        super("mewCat 翻译请求已取消")
        this.name = "ManualAbortError"
    }
}

const mapServiceError = (error: unknown): Error => {
    if (error instanceof ManualAbortError) {
        return error
    }
    const candidate = error as {
        code?: unknown
        name?: unknown
        message?: unknown
    }
    if (typeof candidate.code === "string" && ERROR_MESSAGES[candidate.code]) {
        return new Error(ERROR_MESSAGES[candidate.code])
    }
    if (
        typeof candidate.code === "string" &&
        /^ERR_(?:JOSE|JWE|JWK|JWS|JWT)/.test(candidate.code)
    ) {
        return new Error("mewCat 服务身份校验失败")
    }
    if (candidate.name === "TimeoutError" || candidate.name === "AbortError") {
        return new Error("mewCat 翻译请求超时")
    }
    const message =
        typeof candidate.message === "string" ? candidate.message : ""
    if (
        /指纹|签名|公钥|响应关联|时间校验|验签|解密|加密信封|响应状态不一致|响应译文数量不正确|fingerprint|signature|decrypt|encryption header|JWE|JWS/i.test(
            message
        )
    ) {
        return new Error("mewCat 服务身份校验失败")
    }
    if (
        error instanceof TypeError &&
        /fetch|network|load failed|network\s*error/i.test(message)
    ) {
        return new Error("无法连接免费翻译服务")
    }
    return new Error("免费翻译服务请求失败")
}

export const createMewCatService = (
    dependencies: MewCatServiceDependencies = {}
) => {
    const sdk = dependencies.sdk ?? (bundledSdk as MewCatSdkAdapter)
    const fetchImpl = dependencies.fetchImpl ?? fetch
    const activeControllers = new Set<AbortController>()
    const manuallyAborted = new WeakSet<AbortController>()
    let initializationPromise: Promise<MewCatTranslationClient> | undefined

    const controlledFetch = (async (
        input: RequestInfo | URL,
        init: RequestInit = {}
    ) => {
        const controller = new AbortController()
        activeControllers.add(controller)
        const signal = init.signal
            ? AbortSignal.any([init.signal, controller.signal])
            : controller.signal
        try {
            return await fetchImpl(input, { ...init, signal })
        } catch (error) {
            if (manuallyAborted.has(controller)) {
                throw new ManualAbortError()
            }
            throw error
        } finally {
            activeControllers.delete(controller)
        }
    }) as typeof fetch

    const initialize = async () => {
        const saved = await sdk.loadClientState(MEWCAT_SERVICE_ORIGIN)
        const client = await sdk.TranslationClient.connect({
            baseUrl: MEWCAT_SERVICE_ORIGIN,
            ...(saved ? { state: saved } : {}),
            fetcher: controlledFetch,
            pinnedSigningThumbprint: MEWCAT_SIGNING_THUMBPRINT,
            timeoutMs: MEWCAT_TRANSLATE_TIMEOUT_MS
        })
        if (!saved) {
            await sdk.saveClientState(MEWCAT_SERVICE_ORIGIN, client.getState())
        }
        if (!client.getState().clientId) {
            await client.register("mewCat Chrome Extension", {
                timeoutMs: MEWCAT_TRANSLATE_TIMEOUT_MS
            })
            await sdk.saveClientState(MEWCAT_SERVICE_ORIGIN, client.getState())
        }
        return client
    }

    const getClient = () => {
        if (!initializationPromise) {
            const pending = initialize()
            initializationPromise = pending
            void pending.catch(() => {
                if (initializationPromise === pending) {
                    initializationPromise = undefined
                }
            })
        }
        return initializationPromise
    }

    return {
        async translate(input: MewCatTranslateInput): Promise<string[]> {
            try {
                const client = await getClient()
                const requestOptions: MewCatRequestOptions = {
                    timeoutMs: input.timeoutMs ?? MEWCAT_TRANSLATE_TIMEOUT_MS
                }
                const result = await client.translate(
                    {
                        texts: input.texts,
                        targetLanguage: input.targetLanguage,
                        sourceLanguage: input.sourceLanguage
                    },
                    requestOptions
                )
                return result.translations
            } catch (error) {
                throw mapServiceError(error)
            }
        },
        abortAll() {
            for (const controller of activeControllers) {
                manuallyAborted.add(controller)
                controller.abort()
            }
        }
    }
}

export const mewCatService = createMewCatService()
