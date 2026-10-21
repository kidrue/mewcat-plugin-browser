import {
    createIdentity,
    open,
    publicKeys,
    seal,
    type Identity,
    type ServerPublicKeys
} from "@mewcat/protocol"
import type { FastifyInstance } from "fastify"
import { importJWK } from "jose"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { buildApp } from "../src/app.js"
import { loadConfig } from "../src/config.js"
import { testStore } from "./helpers.js"

describe("真实加密 HTTP 链路", () => {
    let serverIdentity: Identity
    let clientIdentity: Identity
    let publicServer: ServerPublicKeys
    let publicClient: ServerPublicKeys
    let fixture: Awaited<ReturnType<typeof testStore>>
    let app: FastifyInstance
    let calls: number
    const config = loadConfig({
        NODE_ENV: "test",
        SILICONFLOW_API_KEY: "test-key",
        SILICONFLOW_MODEL: "test-model",
        CLIENT_DAILY_CHARACTERS: "20",
        ALLOWED_ORIGINS: "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
    })
    beforeAll(async () => {
        serverIdentity = await createIdentity()
        clientIdentity = await createIdentity()
        publicServer = await publicKeys(serverIdentity, "server")
        publicClient = await publicKeys(clientIdentity, "registration")
    })
    beforeEach(async () => {
        fixture = await testStore()
        calls = 0
        app = await buildApp({
            config,
            store: fixture.store,
            keys: {
                identity: serverIdentity,
                publicKeys: publicServer,
                ipHashSecret: "test-ip-secret"
            },
            fetcher: async () => {
                calls++
                return Response.json({
                    choices: [
                        {
                            message: { content: '{"translations":["你好"]}' },
                            finish_reason: "stop"
                        }
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 2 }
                })
            }
        })
    })
    afterEach(async () => {
        await app?.close()
        await fixture?.cleanup()
    })

    async function wire(
        clientId: string,
        path: string,
        data: unknown,
        options: {
            timestamp?: number
            nonce?: string
            identity?: Identity
        } = {}
    ) {
        const nonce = options.nonce ?? crypto.randomUUID()
        return {
            nonce,
            envelope: await seal(
                {
                    v: 1,
                    method: "POST",
                    path,
                    timestamp: options.timestamp ?? Date.now(),
                    nonce,
                    data
                },
                (options.identity ?? clientIdentity).signing.privateKey,
                serverIdentity.encryption.publicKey,
                clientId,
                "server"
            )
        }
    }
    async function register() {
        const { envelope } = await wire(
            "registration",
            "/v1/clients/register",
            {
                name: "Chrome Translate",
                signingKey: publicClient.signingKey,
                encryptionKey: publicClient.encryptionKey
            }
        )
        const response = await app.inject({
            method: "POST",
            url: "/v1/clients/register",
            payload: { envelope }
        })
        expect(response.statusCode).toBe(201)
        const payload = (await open(
            response.json().envelope as string,
            clientIdentity.encryption.privateKey,
            serverIdentity.signing.publicKey,
            "server",
            "registration"
        )) as { data: { clientId: string } }
        return payload.data.clientId
    }
    const translate = {
        texts: ["hello"],
        sourceLanguage: "auto",
        targetLanguage: "zh-CN"
    }

    it("注册不接受已废弃的邀请码字段", async () => {
        const { envelope } = await wire(
            "registration",
            "/v1/clients/register",
            {
                invitation: "a".repeat(43),
                name: "Chrome Translate",
                signingKey: publicClient.signingKey,
                encryptionKey: publicClient.encryptionKey
            }
        )
        const response = await app.inject({
            method: "POST",
            url: "/v1/clients/register",
            payload: { envelope }
        })
        expect(response.statusCode).toBe(401)
    })

    it("注册、翻译、用量查询可解密；数据库不保存原文和译文", async () => {
        const clientId = await register()
        const message = await wire(clientId, "/v1/translate", translate)
        const response = await app.inject({
            method: "POST",
            url: "/v1/translate",
            payload: { envelope: message.envelope }
        })
        expect(response.statusCode).toBe(200)
        expect(response.body).not.toContain("你好")
        expect(
            await open(
                response.json().envelope as string,
                clientIdentity.encryption.privateKey,
                serverIdentity.signing.publicKey,
                "server",
                clientId
            )
        ).toMatchObject({
            ok: true,
            nonce: message.nonce,
            data: { translations: ["你好"] }
        })
        const usage = await wire(clientId, "/v1/usage", {})
        const usageResponse = await app.inject({
            method: "POST",
            url: "/v1/usage",
            payload: { envelope: usage.envelope }
        })
        expect(
            await open(
                usageResponse.json().envelope as string,
                clientIdentity.encryption.privateKey,
                serverIdentity.signing.publicKey,
                "server",
                clientId
            )
        ).toMatchObject({ data: { usedCharacters: 5, limitCharacters: 20 } })
        const logs = JSON.stringify(
            await fixture.store.db.translationRequest.findMany()
        )
        expect(logs).not.toContain("hello")
        expect(logs).not.toContain("你好")
        expect(calls).toBe(1)
    })

    it("同一密文并发重放不会重复调用供应商", async () => {
        const clientId = await register()
        const { envelope } = await wire(clientId, "/v1/translate", translate)
        const responses = await Promise.all(
            [1, 2, 3].map(() =>
                app.inject({
                    method: "POST",
                    url: "/v1/translate",
                    payload: { envelope }
                })
            )
        )
        expect(responses.map(response => response.statusCode).sort()).toEqual([
            200, 409, 409
        ])
        expect(calls).toBe(1)
    })

    it("错误签名不能冒充现有设备，且不会提前消耗 nonce", async () => {
        const clientId = await register()
        const nonce = crypto.randomUUID()
        const forged = await wire(clientId, "/v1/translate", translate, {
            nonce,
            identity: serverIdentity
        })
        expect(
            (
                await app.inject({
                    method: "POST",
                    url: "/v1/translate",
                    payload: { envelope: forged.envelope }
                })
            ).statusCode
        ).toBe(401)
        const real = await wire(clientId, "/v1/translate", translate, { nonce })
        expect(
            (
                await app.inject({
                    method: "POST",
                    url: "/v1/translate",
                    payload: { envelope: real.envelope }
                })
            ).statusCode
        ).toBe(200)
        expect(calls).toBe(1)
    })

    it("拒绝过期和跨路由请求", async () => {
        const clientId = await register()
        for (const message of [
            await wire(clientId, "/v1/usage", translate),
            await wire(clientId, "/v1/translate", translate, {
                timestamp: Date.now() - 301_000
            })
        ]) {
            expect(
                (
                    await app.inject({
                        method: "POST",
                        url: "/v1/translate",
                        payload: { envelope: message.envelope }
                    })
                ).statusCode
            ).toBe(401)
        }
        expect(calls).toBe(0)
    })

    it("撤销立即生效，无法访问供应商", async () => {
        const clientId = await register()
        await fixture.store.revokeClient(clientId)
        const { envelope } = await wire(clientId, "/v1/translate", translate)
        expect(
            (
                await app.inject({
                    method: "POST",
                    url: "/v1/translate",
                    payload: { envelope }
                })
            ).statusCode
        ).toBe(403)
        expect(calls).toBe(0)
    })

    it("并发日限额保护全局费用，拒绝请求不会调用上游", async () => {
        const clientId = await register()
        const envelopes = await Promise.all(
            [1, 2, 3, 4, 5].map(() =>
                wire(clientId, "/v1/translate", translate)
            )
        )
        const responses = await Promise.all(
            envelopes.map(({ envelope }) =>
                app.inject({
                    method: "POST",
                    url: "/v1/translate",
                    payload: { envelope }
                })
            )
        )
        expect(
            responses.filter(response => response.statusCode === 200)
        ).toHaveLength(4)
        expect(
            responses.filter(response => response.statusCode === 429)
        ).toHaveLength(1)
        expect(calls).toBe(4)
    })

    it("拒绝空文本、超长批次和自定义上游参数", async () => {
        const clientId = await register()
        for (const data of [
            { ...translate, texts: [" "] },
            { ...translate, texts: ["a".repeat(5001)] },
            { ...translate, model: "expensive-model" }
        ]) {
            const { envelope } = await wire(clientId, "/v1/translate", data)
            expect(
                (
                    await app.inject({
                        method: "POST",
                        url: "/v1/translate",
                        payload: { envelope }
                    })
                ).statusCode
            ).toBe(400)
        }
        expect(calls).toBe(0)
    })

    it("拒绝未知 Origin 和裸 JSON，公钥接口不泄露私钥", async () => {
        expect(
            (
                await app.inject({
                    method: "POST",
                    url: "/v1/translate",
                    payload: translate
                })
            ).statusCode
        ).toBe(400)
        expect(
            (
                await app.inject({
                    method: "GET",
                    url: "/v1/keys",
                    headers: { origin: "https://evil.example" }
                })
            ).statusCode
        ).toBe(403)
        const response = await app.inject({ method: "GET", url: "/v1/keys" })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual(publicServer)
        expect(response.json().encryptionKey.d).toBeUndefined()
        await expect(
            importJWK(response.json().signingKey, "ES256")
        ).resolves.toBeDefined()
        expect(
            (await app.inject({ method: "GET", url: "/health" })).statusCode
        ).toBe(200)
    })
})
