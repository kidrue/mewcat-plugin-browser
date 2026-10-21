import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import rateLimit from "@fastify/rate-limit"
import {
    decryptEnvelope,
    feedbackSchema,
    readSigned,
    registrationSchema,
    seal,
    translationSchema,
    validateRequest,
    verifySigned,
    type SignedRequest
} from "@mewcat/protocol"
import Fastify, { LogController, type FastifyRequest } from "fastify"
import { importJWK } from "jose"
import { z, ZodError } from "zod"

import type { Config } from "./config.js"
import { ApiError, publicError } from "./errors.js"
import { createFeedbackMailer, type FeedbackMailer } from "./feedback-mailer.js"
import type { ServerKeys } from "./keys.js"
import {
    clientDailyKey,
    dayWindow,
    feedbackBuckets,
    hashIp,
    translationBuckets
} from "./limits.js"
import { createProvider, type Fetch } from "./provider.js"
import type { Store } from "./store.js"

interface Options {
    config: Config
    store: Store
    keys: ServerKeys
    fetcher?: Fetch
    feedbackMailer?: FeedbackMailer
}
interface Authenticated {
    request: SignedRequest
    clientId: string
    replyKey: CryptoKey
    recipientId: string
}
const wireSchema = z.strictObject({
    envelope: z.string().min(100).max(100_000)
})

export async function buildApp({
    config,
    store,
    keys,
    fetcher,
    feedbackMailer
}: Options) {
    const origins = config.ALLOWED_ORIGINS.split(",")
        .map(value => value.trim())
        .filter(Boolean)
    const app = Fastify({
        logger:
            config.NODE_ENV === "test" ? false : { level: config.LOG_LEVEL },
        logController: new LogController({ disableRequestLogging: true }),
        bodyLimit: 128 * 1024,
        requestTimeout: 15_000,
        trustProxy: config.TRUST_PROXY
            ? config.TRUST_PROXY.split(",").map(value => value.trim())
            : false
    })
    const provider = createProvider(
        {
            apiKey: config.SILICONFLOW_API_KEY,
            baseUrl: config.SILICONFLOW_BASE_URL,
            model: config.SILICONFLOW_MODEL,
            timeoutMs: config.UPSTREAM_TIMEOUT_MS,
            maxTokens: config.MAX_OUTPUT_TOKENS
        },
        fetcher
    )
    const mailer = feedbackMailer ?? createFeedbackMailer(config)
    app.addHook("onClose", async () => {
        mailer.close()
    })
    let inFlight = 0
    let cryptoInFlight = 0

    app.addHook("onRequest", async (request, reply) => {
        reply.header("Cache-Control", "no-store")
        const origin = request.headers.origin
        if (origin && !origins.includes(origin))
            throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "来源不被允许")
    })
    await app.register(cors, {
        origin: origins,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type"],
        credentials: false
    })
    await app.register(helmet)
    await app.register(rateLimit, {
        max: config.INGRESS_REQUESTS_PER_MINUTE,
        timeWindow: "1 minute",
        cache: 10_000,
        keyGenerator: request => hashIp(request.ip, keys.ipHashSecret),
        errorResponseBuilder: () =>
            new ApiError(429, "RATE_LIMITED", "请求过于频繁，请稍后重试")
    })
    app.addHook("onResponse", async (request, reply) => {
        request.log.info(
            {
                requestId: request.id,
                route: request.routeOptions.url,
                status: reply.statusCode,
                durationMs: reply.elapsedTime
            },
            "request completed"
        )
    })
    app.setErrorHandler((error, request, reply) => {
        const statusCode = (error as { statusCode?: number }).statusCode
        const safe =
            error instanceof ZodError
                ? new ApiError(400, "INVALID_REQUEST", "请求格式不正确")
                : statusCode && statusCode >= 400 && statusCode < 500
                  ? new ApiError(
                        statusCode,
                        statusCode === 429 ? "RATE_LIMITED" : "INVALID_REQUEST",
                        statusCode === 413 ? "请求体过大" : "请求被拒绝"
                    )
                  : publicError(error)
        if (safe.status >= 500)
            request.log.error(
                { requestId: request.id, code: safe.code },
                "request failed"
            )
        reply
            .code(safe.status)
            .send({ error: { code: safe.code, message: safe.message } })
    })
    app.setNotFoundHandler((_request, reply) =>
        reply
            .code(404)
            .send({ error: { code: "NOT_FOUND", message: "接口不存在" } })
    )
    app.get("/health", async (_request, reply) => {
        try {
            await store.db.$queryRaw`SELECT 1`
            return { status: "ok" }
        } catch {
            return reply.code(503).send({ status: "unavailable" })
        }
    })
    app.get("/v1/keys", async () => keys.publicKeys)

    async function authenticate(
        request: FastifyRequest,
        path: string
    ): Promise<Authenticated> {
        if (request.url !== path)
            throw new ApiError(400, "INVALID_REQUEST", "此接口不接受查询参数")
        const { envelope } = wireSchema.parse(request.body)
        if (cryptoInFlight >= 32)
            throw new ApiError(503, "SERVER_BUSY", "服务繁忙，请稍后重试")
        cryptoInFlight++
        try {
            const signed = await decryptEnvelope(
                envelope,
                keys.identity.encryption.privateKey,
                keys.publicKeys.keyId
            )
            const untrusted = readSigned(signed)
            if (path === "/v1/clients/register") {
                if (untrusted.signerId !== "registration")
                    throw new Error("Invalid registration signer")
                const unverified = validateRequest(
                    untrusted.payload,
                    path,
                    Date.now(),
                    config.CLOCK_SKEW_MS
                )
                const registration = registrationSchema.parse(unverified.data)
                const signingKey = (await importJWK(
                    registration.signingKey,
                    "ES256"
                )) as CryptoKey
                const verified = validateRequest(
                    await verifySigned(signed, signingKey, "registration"),
                    path,
                    Date.now(),
                    config.CLOCK_SKEW_MS
                )
                return {
                    request: verified,
                    clientId: "registration",
                    recipientId: "registration",
                    replyKey: (await importJWK(
                        registration.encryptionKey,
                        "RSA-OAEP-256"
                    )) as CryptoKey
                }
            }
            const client = await store.db.client.findUnique({
                where: { id: untrusted.signerId }
            })
            if (!client) throw new Error("Unknown client")
            const signingKey = (await importJWK(
                JSON.parse(client.signingKey),
                "ES256"
            )) as CryptoKey
            const verified = validateRequest(
                await verifySigned(signed, signingKey, client.id),
                path,
                Date.now(),
                config.CLOCK_SKEW_MS
            )
            const replyKey = (await importJWK(
                JSON.parse(client.encryptionKey),
                "RSA-OAEP-256"
            )) as CryptoKey
            return {
                request: verified,
                clientId: client.id,
                replyKey,
                recipientId: client.id
            }
        } catch {
            throw new ApiError(
                401,
                "UNAUTHORIZED",
                "密文、签名或请求有效期校验失败"
            )
        } finally {
            cryptoInFlight--
        }
    }

    type Action = (
        auth: Authenticated,
        request: FastifyRequest
    ) => Promise<unknown>
    function secureRoute(path: string, status: number, action: Action) {
        app.post(path, async (request, reply) => {
            const auth = await authenticate(request, path)
            let body: unknown
            let responseStatus = status
            try {
                if (path !== "/v1/clients/register") {
                    // 未来时间戳仍可能在两倍容差内有效，保存到 timestamp + skew。
                    await store.consumeNonce(
                        auth.clientId,
                        auth.request.nonce,
                        auth.request.timestamp + config.CLOCK_SKEW_MS + 1000
                    )
                }
                body = { ok: true, data: await action(auth, request) }
            } catch (error) {
                const safe =
                    error instanceof ZodError
                        ? new ApiError(400, "INVALID_REQUEST", "请求参数不正确")
                        : publicError(error)
                responseStatus = safe.status
                body = {
                    ok: false,
                    error: { code: safe.code, message: safe.message }
                }
                if (safe.status >= 500)
                    request.log.error(
                        { requestId: request.id, code: safe.code },
                        "operation failed"
                    )
            }
            const payload = {
                v: 1,
                path,
                nonce: auth.request.nonce,
                timestamp: Date.now(),
                ...(body as object)
            }
            const envelope = await seal(
                payload,
                keys.identity.signing.privateKey,
                auth.replyKey,
                keys.publicKeys.keyId,
                auth.recipientId
            )
            return reply.code(responseStatus).send({ envelope })
        })
    }
    secureRoute("/v1/clients/register", 201, async (auth, request) => {
        const data = registrationSchema.parse(auth.request.data)
        const window = dayWindow()
        const client = await store.registerClient(
            data.name,
            data.signingKey,
            data.encryptionKey,
            [
                {
                    key: `register:${hashIp(request.ip, keys.ipHashSecret)}:${window.id}`,
                    amount: 1,
                    limit: config.REGISTRATIONS_PER_IP_PER_DAY,
                    expiresAt: window.expiresAt
                }
            ]
        )
        return { clientId: client.id }
    })
    secureRoute("/v1/usage", 200, async auth => {
        z.strictObject({}).parse(auth.request.data)
        return {
            usedCharacters: await store.used(clientDailyKey(auth.clientId)),
            limitCharacters: config.CLIENT_DAILY_CHARACTERS,
            resetsAt: dayWindow().expiresAt.toISOString()
        }
    })
    secureRoute("/v1/feedback", 201, async (auth, request) => {
        const data = feedbackSchema.parse(auth.request.data)
        await store.consumeBuckets(
            feedbackBuckets(
                config,
                auth.clientId,
                hashIp(request.ip, keys.ipHashSecret)
            )
        )
        try {
            await mailer.send(data)
        } catch (error) {
            if (error instanceof ApiError) throw error
            throw new ApiError(
                502,
                "FEEDBACK_SEND_FAILED",
                "反馈发送失败，请稍后重试"
            )
        }
        return { accepted: true }
    })
    secureRoute("/v1/translate", 200, async (auth, request) => {
        const data = translationSchema.parse(auth.request.data)
        if (inFlight >= config.MAX_CONCURRENT_REQUESTS)
            throw new ApiError(503, "SERVER_BUSY", "服务繁忙，请稍后重试")
        inFlight++
        try {
            const characters = data.texts.reduce(
                (sum, value) => sum + value.length,
                0
            )
            const record = await store.reserveTranslation(
                auth.clientId,
                characters,
                translationBuckets(
                    config,
                    auth.clientId,
                    hashIp(request.ip, keys.ipHashSecret),
                    characters
                )
            )
            try {
                const result = await provider.translate(data)
                await store.finishTranslation(
                    record.id,
                    "success",
                    result.promptTokens,
                    result.completionTokens
                )
                return { translations: result.translations }
            } catch (error) {
                // 失败也保留预占额度；供应商可能已经计费，自动重试会扩大费用。
                await store.finishTranslation(record.id, "failed")
                throw error
            }
        } finally {
            inFlight--
        }
    })
    return app
}
