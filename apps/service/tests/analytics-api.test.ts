import { TranslationClient } from "@mewcat/client"
import {
    analyticsQuerySchema,
    analyticsResultSchema,
    createIdentity,
    publicKeys,
    seal
} from "@mewcat/protocol"
import { importJWK } from "jose"
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from "vitest"

import { AdminAnalytics } from "../src/analytics/admin.js"
import { AnalyticsQuery } from "../src/analytics/query.js"
import { AnalyticsStore } from "../src/analytics/store.js"
import { buildApp } from "../src/app.js"
import { loadConfig } from "../src/config.js"
import { testStore } from "./helpers.js"

describe("管理员分析协议", () => {
    it("限制真实 UTC 日期、90 天、分页及未使用的参数", () => {
        const input = {
            operation: "calls",
            from: "2026-10-30",
            to: "2026-11-06"
        }
        expect(analyticsQuerySchema.parse(input)).toMatchObject({ limit: 20 })
        for (const change of [
            { from: "2026-02-30" },
            { from: "2025-01-01" },
            { limit: 101 },
            { cursor: "x".repeat(501) },
            { unused: true }
        ])
            expect(
                analyticsQuerySchema.safeParse({ ...input, ...change }).success
            ).toBe(false)
        expect(
            analyticsQuerySchema.safeParse({
                operation: "profile",
                clientId: crypto.randomUUID(),
                from: "2026-11-01"
            }).success
        ).toBe(false)
    })
    it("严格拒绝未知结果和夹带正文的响应", () => {
        expect(
            analyticsResultSchema.safeParse({ operation: "unknown" }).success
        ).toBe(false)
        expect(
            analyticsResultSchema.safeParse({
                operation: "calls",
                asOf: new Date().toISOString(),
                items: [],
                nextCursor: null,
                original: "secret"
            }).success
        ).toBe(false)
    })
})

describe("管理员分析加密接口", () => {
    it("真实 HTTP 断开会传递取消信号，并允许后续查询", async () => {
        const address = await app.listen({ host: "127.0.0.1", port: 0 })
        const sdk = await TranslationClient.connect({ baseUrl: address })
        await sdk.register("HTTP cancellation")
        config.ANALYTICS_ADMIN_CLIENT_IDS.push(sdk.getState().clientId!)
        let release!: () => void,
            started!: () => void,
            observed: AbortSignal | undefined
        const ready = new Promise<void>(resolve => {
            started = resolve
        })
        const blocked = new Promise<void>(resolve => {
            release = resolve
        })
        const original = AnalyticsQuery.prototype.summary
        const spy = vi
            .spyOn(AnalyticsQuery.prototype, "summary")
            .mockImplementation(async function (this: AnalyticsQuery, ...args) {
                observed = args[4]
                started()
                await blocked
                return original.apply(this, args)
            })
        const controller = new AbortController()
        const waiting = sdk
            .queryAnalytics(
                { operation: "overview", ...range },
                { signal: controller.signal }
            )
            .catch(error => error)
        try {
            await ready
            controller.abort()
            expect((await waiting).name).toBe("AbortError")
            await vi.waitFor(() => expect(observed?.aborted).toBe(true))
        } finally {
            release()
            spy.mockRestore()
        }
        await expect(
            sdk.queryAnalytics({ operation: "overview", ...range })
        ).resolves.toMatchObject({ operation: "overview" })
    })
    it("分析样本超过聚合执行量时返回未知覆盖率，不拒绝合法查询", async () => {
        const sdk = await client()
        const id = sdk.getState().clientId!
        const today = new Date().toISOString().slice(0, 10)
        await fixture.store.db.analyticsDaily.create({
            data: {
                clientId: id,
                day: today,
                dimension: "route",
                value: "/v1/translate",
                requests: 1n,
                executions: 1n
            }
        })
        for (let index = 0; index < 2; index++)
            await fixture.store.db.contentAnalysis.create({
                data: {
                    requestId: crypto.randomUUID(),
                    requestCreatedAt: new Date(),
                    clientId: id,
                    version: "topics-v1",
                    topics: "[]",
                    keywords: "[]",
                    model: "fake",
                    sampledCharacters: 1,
                    originalCharacters: 1,
                    truncated: false
                }
            })
        await expect(
            sdk.queryAnalytics({
                operation: "overview",
                from: today,
                to: range.to
            })
        ).resolves.toMatchObject({ analysis: { completed: 2, coverage: null } })
    })
    it("取消查询后停止后续读取，当前数据库工作完成后归还并发槽", async () => {
        const sdk = await client()
        const admin = new AdminAnalytics(
            new AnalyticsStore(fixture.store, config)
        )
        let release!: () => void
        let started!: () => void
        const ready = new Promise<void>(resolve => {
            started = resolve
        })
        const blocked = new Promise<void>(resolve => {
            release = resolve
        })
        const original = admin.queries.summary.bind(admin.queries)
        const summary = vi
            .spyOn(admin.queries, "summary")
            .mockImplementation(async (...args) => {
                started()
                await blocked
                return original(...args)
            })
        const controller = new AbortController()
        const waiting = admin.query(
            sdk.getState().clientId!,
            { operation: "overview", ...range },
            controller.signal
        )
        await ready
        controller.abort()
        release()
        await expect(waiting).rejects.toMatchObject({
            code: "ANALYTICS_CANCELLED"
        })
        summary.mockRestore()
        await expect(
            admin.query(sdk.getState().clientId!, {
                operation: "overview",
                ...range
            })
        ).resolves.toMatchObject({ operation: "overview" })
    })
    it("分页查询不计算全站汇总，并对早于采集的区间报告覆盖不足", async () => {
        const sdk = await client()
        const admin = new AdminAnalytics(
            new AnalyticsStore(fixture.store, config)
        )
        const summary = vi
            .spyOn(admin.queries, "summary")
            .mockRejectedValue(new Error("summary must not run for pagination"))
        const id = sdk.getState().clientId!
        await expect(
            admin.query(id, { operation: "devices", ...range })
        ).resolves.toMatchObject({
            operation: "devices",
            coverage: { aggregateComplete: false }
        })
        await expect(
            admin.query(id, { operation: "calls", ...range })
        ).resolves.toMatchObject({ operation: "calls" })
        expect(summary).not.toHaveBeenCalled()
        summary.mockRestore()
    })
    let fixture: Awaited<ReturnType<typeof testStore>>
    let app: Awaited<ReturnType<typeof buildApp>>
    let identity: Awaited<ReturnType<typeof createIdentity>>
    let config: ReturnType<typeof loadConfig>
    const range = {
        from: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
        to: new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    }
    beforeAll(async () => {
        identity = await createIdentity()
    })
    beforeEach(async () => {
        fixture = await testStore()
        config = loadConfig({
            NODE_ENV: "test",
            SILICONFLOW_API_KEY: "fake",
            SILICONFLOW_MODEL: "fake",
            INGRESS_REQUESTS_PER_MINUTE: "1000"
        })
        app = await buildApp({
            config,
            store: fixture.store,
            keys: {
                identity,
                publicKeys: await publicKeys(identity, "server"),
                ipHashSecret: "test"
            },
            fetcher: async () =>
                Response.json({
                    choices: [
                        {
                            message: { content: '{"translations":["你好"]}' },
                            finish_reason: "stop"
                        }
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 2 }
                })
        })
    })
    afterEach(async () => {
        vi.restoreAllMocks()
        await app?.close()
        await fixture?.cleanup()
    })
    async function client(admin = true) {
        const sdk = await TranslationClient.connect({
            baseUrl: "https://test.local",
            fetcher: async (input, init) => {
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
                return new Response(response.body, {
                    status: response.statusCode,
                    headers: { "content-type": "application/json" }
                })
            }
        })
        await sdk.register("管理员测试设备")
        if (admin)
            config.ANALYTICS_ADMIN_CLIENT_IDS.push(sdk.getState().clientId!)
        return sdk
    }
    it("默认拒绝非管理员，授权查询不会记录画像或消耗翻译额度", async () => {
        const sdk = await client(false)
        await expect(
            sdk.queryAnalytics({ operation: "overview", ...range })
        ).rejects.toMatchObject({ status: 403, code: "ANALYTICS_FORBIDDEN" })
        config.ANALYTICS_ADMIN_CLIENT_IDS.push(sdk.getState().clientId!)
        const before = await fixture.store.db.apiCall.count()
        const result = await sdk.queryAnalytics({
            operation: "overview",
            ...range
        })
        expect(result).toMatchObject({
            operation: "overview",
            totals: { requests: "0" },
            activeDevices: 0,
            analysis: { captureContent: false }
        })
        expect(await fixture.store.db.apiCall.count()).toBe(before)
        expect(await sdk.usage()).toMatchObject({ usedCharacters: 0 })
    })
    it("翻译统计不混入 usage，分页受控且不泄漏正文和设备密钥", async () => {
        const sdk = await client()
        await sdk.translate({ texts: ["hello"], targetLanguage: "zh-CN" })
        await sdk.usage()
        const overview = await sdk.queryAnalytics({
            operation: "overview",
            ...range
        })
        expect(overview).toMatchObject({
            totals: { requests: "1", characters: "5", promptTokens: "10" },
            activeDevices: 1
        })
        const devices = await sdk.queryAnalytics({
            operation: "devices",
            ...range,
            limit: 1
        })
        expect(
            devices.operation === "devices" && devices.items[0]?.client.id
        ).toBe(sdk.getState().clientId)
        const profile = await sdk.queryAnalytics({
            operation: "profile",
            clientId: sdk.getState().clientId!
        })
        expect(profile).toMatchObject({
            operation: "profile",
            client: { name: "管理员测试设备" }
        })
        const first = await sdk.queryAnalytics({
            operation: "calls",
            ...range,
            limit: 1
        })
        expect(first.operation).toBe("calls")
        if (first.operation !== "calls") throw new Error()
        expect(first.nextCursor).toBeTruthy()
        const second = await sdk.queryAnalytics({
            operation: "calls",
            ...range,
            limit: 1,
            cursor: first.nextCursor!
        })
        expect(second.operation === "calls" && second.items[0]?.id).not.toBe(
            first.items[0]?.id
        )
        const serialized = JSON.stringify([
            overview,
            devices,
            profile,
            first,
            second
        ])
        for (const secret of [
            "signingKey",
            "encryptionKey",
            "hello",
            "你好",
            "nonce",
            "original",
            "translated"
        ])
            expect(serialized).not.toContain(secret)
        await expect(
            sdk.queryAnalytics({
                operation: "calls",
                ...range,
                cursor: "broken"
            })
        ).rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" })
    })
    it("移除白名单和撤销设备后不能再读取，签名防重放", async () => {
        const sdk = await client()
        const state = sdk.getState()
        const keys = await publicKeys(identity, "server")
        const envelope = await seal(
            {
                v: 1,
                method: "POST",
                path: "/v1/analytics/query",
                timestamp: Date.now(),
                nonce: crypto.randomUUID(),
                data: { operation: "overview", ...range }
            },
            state.identity.signing.privateKey,
            (await importJWK(keys.encryptionKey, "RSA-OAEP-256")) as CryptoKey,
            state.clientId!,
            "server"
        )
        const request = () =>
            app.inject({
                method: "POST",
                url: "/v1/analytics/query",
                payload: { envelope }
            })
        expect((await request()).statusCode).toBe(200)
        expect((await request()).statusCode).toBe(409)
        config.ANALYTICS_ADMIN_CLIENT_IDS.length = 0
        await expect(
            sdk.queryAnalytics({ operation: "overview", ...range })
        ).rejects.toMatchObject({ status: 403 })
        config.ANALYTICS_ADMIN_CLIENT_IDS.push(state.clientId!)
        await fixture.store.revokeClient(state.clientId!)
        await expect(
            sdk.queryAnalytics({ operation: "overview", ...range })
        ).rejects.toMatchObject({ code: "CLIENT_REVOKED" })
        expect(
            (
                await app.inject({
                    method: "POST",
                    url: "/v1/analytics/query",
                    payload: { envelope: "x".repeat(120) }
                })
            ).statusCode
        ).toBe(401)
    })
    it("独立每分钟 60 次限制不会扣除日额度", async () => {
        const sdk = await client()
        const minute = Math.floor(Date.now() / 60000)
        await fixture.store.db.usageBucket.create({
            data: {
                key: `analytics:${sdk.getState().clientId}:${minute}`,
                used: 60,
                expiresAt: new Date((minute + 1) * 60000)
            }
        })
        await expect(
            sdk.queryAnalytics({ operation: "overview", ...range })
        ).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" })
        expect((await sdk.usage()).usedCharacters).toBe(0)
    })
    it("查询并发满返回忙碌，失败后归还槽位，大整数保持精度", async () => {
        const sdk = await client()
        const admin = new AdminAnalytics(
            new AnalyticsStore(fixture.store, config)
        )
        const original = admin.queries.summary.bind(admin.queries)
        let release!: () => void
        let started!: () => void
        let count = 0
        const ready = new Promise<void>(resolve => {
            started = resolve
        })
        const blocked = new Promise<void>(resolve => {
            release = resolve
        })
        const spy = vi
            .spyOn(admin.queries, "summary")
            .mockImplementation(async (...args) => {
                if (++count === 2) started()
                await blocked
                return original(...args)
            })
        const id = sdk.getState().clientId!
        const one = admin.query(id, { operation: "overview", ...range })
        const two = admin.query(id, { operation: "overview", ...range })
        await ready
        await expect(
            admin.query(id, { operation: "overview", ...range })
        ).rejects.toMatchObject({ code: "ANALYTICS_BUSY" })
        release()
        await Promise.all([one, two])
        spy.mockRejectedValueOnce(new Error("database unavailable"))
        await expect(
            admin.query(id, { operation: "overview", ...range })
        ).rejects.toThrow("database unavailable")
        spy.mockRestore()
        await fixture.store.db.analyticsDaily.create({
            data: {
                clientId: id,
                day: range.from,
                dimension: "route",
                value: "/v1/translate",
                requests: 9007199254740993n,
                characters: 9007199254740997n
            }
        })
        expect(
            await admin.query(id, { operation: "overview", ...range })
        ).toMatchObject({
            totals: {
                requests: "9007199254740993",
                characters: "9007199254740997"
            }
        })
    })
    it("白名单去空白去重，默认禁用并拒绝非法或过多 UUID", () => {
        const env = { SILICONFLOW_API_KEY: "fake", SILICONFLOW_MODEL: "fake" }
        const id = crypto.randomUUID()
        expect(
            loadConfig({ ...env, ANALYTICS_ADMIN_CLIENT_IDS: ` ${id},${id}, ` })
                .ANALYTICS_ADMIN_CLIENT_IDS
        ).toEqual([id])
        expect(loadConfig(env).ANALYTICS_ADMIN_CLIENT_IDS).toEqual([])
        for (const value of [
            "bad",
            Array.from({ length: 21 }, () => crypto.randomUUID()).join(",")
        ])
            expect(() =>
                loadConfig({ ...env, ANALYTICS_ADMIN_CLIENT_IDS: value })
            ).toThrow()
    })
})
