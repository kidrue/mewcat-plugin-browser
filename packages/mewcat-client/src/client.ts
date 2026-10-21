import {
    createIdentity,
    feedbackResultSchema,
    feedbackSchema,
    open,
    publicKeys,
    responseSchema,
    seal,
    serverKeysSchema,
    translationResultSchema,
    translationSchema,
    usageSchema,
    type FeedbackInput,
    type Identity,
    type ServerPublicKeys
} from "@mewcat/protocol"
import { calculateJwkThumbprint, importJWK } from "jose"
import { z } from "zod"

export interface ClientState {
    identity: Identity
    clientId?: string
}
export interface ClientOptions {
    baseUrl: string
    state?: ClientState
    fetcher?: typeof fetch
    pinnedSigningThumbprint?: string
    timeoutMs?: number
    signal?: AbortSignal
}
export interface RequestOptions {
    signal?: AbortSignal
    timeoutMs?: number
}
export class TranslationError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number
    ) {
        super(message)
        this.name = "TranslationError"
    }
}

/** 在扩展 background/service worker 中调用，不向网页暴露这个实例或 CryptoKey。 */
export class TranslationClient {
    private constructor(
        private readonly baseUrl: string,
        private readonly state: ClientState,
        private readonly keys: ServerPublicKeys,
        private readonly serverEncryptionKey: CryptoKey,
        private readonly serverSigningKey: CryptoKey,
        private readonly fetcher: typeof fetch,
        private readonly timeoutMs: number
    ) {}

    static async connect(options: ClientOptions): Promise<TranslationClient> {
        const url = new URL(options.baseUrl)
        if (
            url.protocol !== "https:" &&
            !(
                url.protocol === "http:" &&
                ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
            )
        )
            throw new Error("远程翻译服务必须使用 HTTPS")
        if (
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            url.pathname !== "/"
        )
            throw new Error("baseUrl 应为服务的 origin，不含路径或凭证")
        const fetcher = options.fetcher ?? fetch
        const timeoutMs = options.timeoutMs ?? 45_000
        options.signal?.throwIfAborted()
        const signal = options.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
            : AbortSignal.timeout(timeoutMs)
        const response = await fetcher(`${url.origin}/v1/keys`, {
            redirect: "error",
            credentials: "omit",
            cache: "no-store",
            signal
        })
        if (!response.ok)
            throw new TranslationError(
                "KEYS_UNAVAILABLE",
                "无法获取服务器公钥",
                response.status
            )
        const keys = serverKeysSchema.parse(await response.json())
        if (
            options.pinnedSigningThumbprint &&
            (await calculateJwkThumbprint(keys.signingKey)) !==
                options.pinnedSigningThumbprint
        )
            throw new Error("服务器公钥与固定指纹不一致")
        const state = options.state ?? { identity: await createIdentity() }
        return new TranslationClient(
            url.origin,
            state,
            keys,
            (await importJWK(keys.encryptionKey, "RSA-OAEP-256")) as CryptoKey,
            (await importJWK(keys.signingKey, "ES256")) as CryptoKey,
            fetcher,
            timeoutMs
        )
    }
    getState(): ClientState {
        return { ...this.state }
    }

    private async request(
        path: string,
        data: unknown,
        registration = false,
        options: RequestOptions = {}
    ): Promise<unknown> {
        const clientId = registration ? "registration" : this.state.clientId
        if (!clientId) throw new Error("请先注册客户端")
        options.signal?.throwIfAborted()
        const nonce = crypto.randomUUID()
        const timestamp = Date.now()
        const envelope = await seal(
            { v: 1, method: "POST", path, timestamp, nonce, data },
            this.state.identity.signing.privateKey,
            this.serverEncryptionKey,
            clientId,
            this.keys.keyId
        )
        const response = await this.fetcher(`${this.baseUrl}${path}`, {
            method: "POST",
            redirect: "error",
            credentials: "omit",
            cache: "no-store",
            signal: options.signal
                ? AbortSignal.any([
                      options.signal,
                      AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs)
                  ])
                : AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ envelope })
        })
        const wire: unknown = await response.json()
        const parsed = z
            .strictObject({ envelope: z.string().min(100).max(1_000_000) })
            .safeParse(wire)
        if (!parsed.success) {
            // 未认证阶段允许明文失败，成功结果一律要求签名和加密。
            if (!response.ok)
                throw new TranslationError(
                    "REQUEST_REJECTED",
                    `请求被拒绝（HTTP ${response.status}）`,
                    response.status
                )
            throw new Error("服务器响应缺少加密信封")
        }
        const payload = responseSchema.parse(
            await open(
                parsed.data.envelope,
                this.state.identity.encryption.privateKey,
                this.serverSigningKey,
                this.keys.keyId,
                clientId
            )
        )
        if (
            payload.nonce !== nonce ||
            payload.path !== path ||
            payload.timestamp < timestamp - 300_000 ||
            Math.abs(Date.now() - payload.timestamp) > 300_000
        )
            throw new Error("服务器响应关联或时间校验失败")
        if (!payload.ok)
            throw new TranslationError(
                payload.error.code,
                payload.error.message,
                response.status
            )
        if (!response.ok) throw new Error("服务器响应状态不一致")
        return payload.data
    }
    async register(
        name = "chorme-translate",
        options: RequestOptions = {}
    ): Promise<string> {
        if (this.state.clientId) throw new Error("客户端已经注册")
        const keys = await publicKeys(this.state.identity, "registration")
        const result = z.strictObject({ clientId: z.string().uuid() }).parse(
            await this.request(
                "/v1/clients/register",
                {
                    name,
                    signingKey: keys.signingKey,
                    encryptionKey: keys.encryptionKey
                },
                true,
                options
            )
        )
        this.state.clientId = result.clientId
        return result.clientId
    }
    async translate(
        input: {
            texts: string[]
            targetLanguage: string
            sourceLanguage?: string
        },
        options: RequestOptions = {}
    ) {
        const data = translationSchema.parse(input)
        const result = translationResultSchema.parse(
            await this.request("/v1/translate", data, false, options)
        )
        if (result.translations.length !== data.texts.length)
            throw new Error("服务器响应译文数量不正确")
        return result
    }
    async usage(options: RequestOptions = {}) {
        return usageSchema.parse(
            await this.request("/v1/usage", {}, false, options)
        )
    }
    async submitFeedback(input: FeedbackInput, options: RequestOptions = {}) {
        return feedbackResultSchema.parse(
            await this.request(
                "/v1/feedback",
                feedbackSchema.parse(input),
                false,
                options
            )
        )
    }
}

export { createIdentity } from "@mewcat/protocol"
