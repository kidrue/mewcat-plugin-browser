import { TranslationClient } from "@mewcat/client"
import {
    createIdentity,
    publicKeys,
    seal,
    type Identity
} from "@mewcat/protocol"
import type { FastifyInstance } from "fastify"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { buildApp } from "../src/app.js"
import { loadConfig } from "../src/config.js"
import { testStore } from "./helpers.js"

describe("浏览器兼容客户端", () => {
    let fixture: Awaited<ReturnType<typeof testStore>>
    let app: FastifyInstance
    let server: Identity
    beforeEach(async () => {
        fixture = await testStore()
        server = await createIdentity()
        app = await buildApp({
            config: loadConfig({
                NODE_ENV: "test",
                SILICONFLOW_API_KEY: "test-key",
                SILICONFLOW_MODEL: "test-model"
            }),
            store: fixture.store,
            keys: {
                identity: server,
                publicKeys: await publicKeys(server, "server"),
                ipHashSecret: "test-secret"
            },
            fetcher: async () =>
                Response.json({
                    choices: [
                        {
                            message: { content: '{"translations":["你好"]}' },
                            finish_reason: "stop"
                        }
                    ]
                })
        })
    })
    afterEach(async () => {
        await app?.close()
        await fixture?.cleanup()
    })
    const fetcher: typeof fetch = async (url, options) => {
        const response = await app.inject({
            method: options?.method === "POST" ? "POST" : "GET",
            url: new URL(String(url)).pathname,
            ...(options?.body ? { payload: String(options.body) } : {}),
            headers: { "content-type": "application/json" }
        })
        return new Response(response.body, {
            status: response.statusCode,
            headers: { "content-type": "application/json" }
        })
    }

    it("原生 Web Crypto 身份完成注册、翻译、持久化状态恢复和用量查询", async () => {
        const client = await TranslationClient.connect({
            baseUrl: "http://localhost:3000",
            fetcher
        })
        await client.register("chorme-translate")
        expect(
            await client.translate({
                texts: ["hello"],
                targetLanguage: "zh-CN"
            })
        ).toEqual({ translations: ["你好"] })
        const state = structuredClone(client.getState())
        expect(state.identity.encryption.privateKey.extractable).toBe(false)
        const restored = await TranslationClient.connect({
            baseUrl: "http://localhost:3000",
            fetcher,
            state
        })
        expect(await restored.usage()).toMatchObject({
            usedCharacters: 5,
            limitCharacters: 20_000
        })
        await fixture.store.revokeClient(state.clientId!)
        await expect(
            restored.translate({ texts: ["hello"], targetLanguage: "zh-CN" })
        ).rejects.toMatchObject({ code: "CLIENT_REVOKED" })
    })

    it("拒绝被调换 nonce 的有效签名响应", async () => {
        const identity = await createIdentity()
        const keys = await publicKeys(server, "server")
        const envelope = await seal(
            {
                v: 1,
                path: "/v1/translate",
                nonce: crypto.randomUUID(),
                timestamp: Date.now(),
                ok: true,
                data: { translations: ["伪造关联"] }
            },
            server.signing.privateKey,
            identity.encryption.publicKey,
            "server",
            "client"
        )
        const client = await TranslationClient.connect({
            baseUrl: "http://localhost:3000",
            state: { identity, clientId: "client" },
            fetcher: async (_url, init) =>
                init?.method === "POST"
                    ? Response.json({ envelope })
                    : Response.json(keys)
        })
        await expect(
            client.translate({ texts: ["hello"], targetLanguage: "zh-CN" })
        ).rejects.toThrow(/响应/)
    })

    it("网络丢失注册响应后，同一持久化身份能安全恢复", async () => {
        const state = { identity: await createIdentity() }
        const loseResponse: typeof fetch = async (url, options) => {
            const response = await fetcher(url, options)
            if (options?.method === "POST")
                throw new TypeError("Network disconnected after commit")
            return response
        }
        const first = await TranslationClient.connect({
            baseUrl: "http://localhost:3000",
            state: structuredClone(state),
            fetcher: loseResponse
        })
        await expect(first.register()).rejects.toThrow("Network disconnected")
        const retry = await TranslationClient.connect({
            baseUrl: "http://localhost:3000",
            state: structuredClone(state),
            fetcher
        })
        const clientId = await retry.register()
        expect(await fixture.store.db.client.count()).toBe(1)
        expect((await fixture.store.db.client.findFirstOrThrow()).id).toBe(
            clientId
        )
        expect(await retry.usage()).toMatchObject({ usedCharacters: 0 })
    })

    it("拒绝未签名成功响应和错误的固定服务器公钥", async () => {
        const identity = await createIdentity()
        const keys = await publicKeys(server, "server")
        const fakeFetch: typeof fetch = async (_url, init) =>
            Response.json(
                init?.method === "POST" ? { translations: ["fake"] } : keys
            )
        const client = await TranslationClient.connect({
            baseUrl: "http://localhost:3000",
            state: { identity, clientId: "client" },
            fetcher: fakeFetch
        })
        await expect(
            client.translate({ texts: ["hello"], targetLanguage: "zh-CN" })
        ).rejects.toThrow()
        await expect(
            TranslationClient.connect({
                baseUrl: "http://localhost:3000",
                fetcher: fakeFetch,
                pinnedSigningThumbprint: "wrong-key"
            })
        ).rejects.toThrow(/公钥/)
    })

    it("远程服务必须使用 HTTPS，未注册客户端不能翻译", async () => {
        await expect(
            TranslationClient.connect({
                baseUrl: "http://example.com",
                fetcher
            })
        ).rejects.toThrow(/HTTPS/)
        const client = await TranslationClient.connect({
            baseUrl: "http://localhost:3000",
            fetcher
        })
        await expect(
            client.translate({ texts: ["hello"], targetLanguage: "zh-CN" })
        ).rejects.toThrow(/注册/)
    })

    it("连接和单次翻译均支持外部取消信号", async () => {
        const connectController = new AbortController()
        connectController.abort()
        await expect(
            TranslationClient.connect({
                baseUrl: "http://localhost:3000",
                fetcher,
                signal: connectController.signal
            })
        ).rejects.toMatchObject({ name: "AbortError" })

        const keys = await publicKeys(server, "server")
        const identity = await createIdentity()
        const requestController = new AbortController()
        const waitingFetcher: typeof fetch = async (_url, init) => {
            if (init?.method !== "POST") return Response.json(keys)
            init.signal?.throwIfAborted()
            return await new Promise<Response>((_resolve, reject) => {
                init.signal?.addEventListener(
                    "abort",
                    () => reject(init.signal?.reason),
                    { once: true }
                )
            })
        }
        const client = await TranslationClient.connect({
            baseUrl: "http://localhost:3000",
            state: { identity, clientId: crypto.randomUUID() },
            fetcher: waitingFetcher
        })
        const pending = client.translate(
            { texts: ["hello"], targetLanguage: "zh-CN" },
            { signal: requestController.signal, timeoutMs: 1000 }
        )
        requestController.abort()
        await expect(pending).rejects.toMatchObject({ name: "AbortError" })
    })
})
