import { TranslationClient } from "@mewcat/client"
import { createIdentity, publicKeys } from "@mewcat/protocol"
import type { FastifyInstance } from "fastify"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AnalyticsStore } from "../src/analytics/store.js"
import { buildApp } from "../src/app.js"
import { loadConfig } from "../src/config.js"
import { testStore } from "./helpers.js"

describe("调用画像 HTTP 接入", () => {
    let fixture: Awaited<ReturnType<typeof testStore>>
    let app: FastifyInstance
    let identity: Awaited<ReturnType<typeof createIdentity>>
    let upstreamFailure = false
    const config = loadConfig({
        NODE_ENV: "test",
        SILICONFLOW_API_KEY: "fake",
        SILICONFLOW_MODEL: "fake",
        ANALYTICS_CAPTURE_CONTENT: "true",
        ANALYTICS_CONTENT_KEY: Buffer.alloc(32, 7).toString("base64"),
        CLIENT_DAILY_CHARACTERS: "20"
    })
    beforeAll(async () => {
        identity = await createIdentity()
    })
    beforeEach(async () => {
        fixture = await testStore()
        upstreamFailure = false
        app = await buildApp({
            config,
            store: fixture.store,
            keys: {
                identity,
                publicKeys: await publicKeys(identity, "server"),
                ipHashSecret: "test"
            },
            fetcher: async () =>
                upstreamFailure
                    ? new Response("", { status: 503 })
                    : Response.json({
                          choices: [
                              {
                                  message: {
                                      content: '{"translations":["你好"]}'
                                  },
                                  finish_reason: "stop"
                              }
                          ],
                          usage: { prompt_tokens: 10, completion_tokens: 2 }
                      })
        })
    })
    afterEach(async () => {
        await app?.close()
        await fixture?.cleanup()
    })
    async function client() {
        const fetcher: typeof fetch = async (input, init) => {
            const response = await app.inject({
                method: (init?.method ?? "GET") as "GET" | "POST",
                url: new URL(String(input)).pathname,
                ...(init?.body
                    ? {
                          payload: String(init.body),
                          headers: { "content-type": "application/json" }
                      }
                    : {})
            })
            await fixture.store.atomic(async () => {})
            return new Response(response.body, {
                status: response.statusCode,
                headers: { "content-type": "application/json" }
            })
        }
        const sdk = await TranslationClient.connect({
            baseUrl: "https://test.local",
            fetcher
        })
        await sdk.register("test")
        return sdk
    }
    it("成功翻译保存语言和加密内容，注册归属实际设备", async () => {
        const sdk = await client()
        await sdk.translate({ texts: ["hello"], targetLanguage: "zh-CN" })
        await sdk.usage()
        const calls = await fixture.store.db.apiCall.findMany({
            orderBy: { createdAt: "asc" }
        })
        expect(
            calls
                .filter(row => row.route !== "/v1/keys")
                .every(row => row.clientId === sdk.getState().clientId)
        ).toBe(true)
        expect(calls.map(row => row.route)).toContain("/v1/translate")
        const record =
            await fixture.store.db.translationRequest.findFirstOrThrow()
        expect(record).toMatchObject({
            sourceLanguage: "auto",
            targetLanguage: "zh-CN",
            segmentCount: 1,
            status: "success",
            model: "fake"
        })
        expect(
            await new AnalyticsStore(fixture.store, config).readContent(
                record.id
            )
        ).toMatchObject({ original: ["hello"], translated: ["你好"] })
        expect(await fixture.store.db.analysisJob.count()).toBe(1)
    })
    it("未认证失败不伪造设备归属，拒绝请求不保存内容", async () => {
        await app.inject({
            method: "POST",
            url: "/v1/translate",
            payload: { envelope: "x".repeat(120) }
        })
        await fixture.store.atomic(async () => {})
        const denied = await fixture.store.db.apiCall.findFirstOrThrow()
        expect(denied).toMatchObject({
            statusCode: 401,
            clientId: null,
            errorCode: "UNAUTHORIZED"
        })
        const sdk = await client()
        await expect(
            sdk.translate({ texts: ["a".repeat(21)], targetLanguage: "zh-CN" })
        ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" })
        expect(await fixture.store.db.translationContent.count()).toBe(0)
        expect(
            await fixture.store.db.apiCall.count({
                where: { statusCode: 429, clientId: sdk.getState().clientId! }
            })
        ).toBe(1)
    })
    it("调用统计持久化失败不改变响应，健康检查暴露进程失败次数", async () => {
        await fixture.store.db.$executeRawUnsafe('DROP TABLE "ApiCall"')
        const response = await app.inject({ method: "GET", url: "/v1/keys" })
        expect(response.statusCode).toBe(200)
        await fixture.store.atomic(async () => {})
        const health = await app.inject({ method: "GET", url: "/health" })
        expect(health.json()).toMatchObject({
            status: "ok",
            analyticsPersistenceFailures: 1
        })
    })
    it("供应商失败仍保存原文并可分析，执行状态与错误正确", async () => {
        const sdk = await client()
        upstreamFailure = true
        await expect(
            sdk.translate({ texts: ["hello"], targetLanguage: "zh-CN" })
        ).rejects.toMatchObject({ status: 502 })
        expect(
            await fixture.store.db.translationRequest.findFirst()
        ).toMatchObject({ status: "failed", errorCode: "UPSTREAM_UNAVAILABLE" })
        expect(await fixture.store.db.analysisJob.count()).toBe(1)
        expect(
            await fixture.store.db.apiCall.findFirst({
                where: { route: "/v1/translate" }
            })
        ).toMatchObject({ statusCode: 502, errorCode: "UPSTREAM_UNAVAILABLE" })
    })
})
