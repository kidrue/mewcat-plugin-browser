import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { AnalyticsStore } from "../src/analytics/store.js"
import { loadConfig } from "../src/config.js"
import { testStore } from "./helpers.js"

export const analyticsConfig = (extra: Record<string, string> = {}) =>
    loadConfig({
        NODE_ENV: "test",
        SILICONFLOW_API_KEY: "fake",
        SILICONFLOW_MODEL: "fake",
        ANALYTICS_CAPTURE_CONTENT: "true",
        ANALYTICS_CONTENT_KEY: Buffer.alloc(32, 7).toString("base64"),
        ...extra
    })

describe("调用与画像持久化", () => {
    let fixture: Awaited<ReturnType<typeof testStore>>
    let analytics: AnalyticsStore
    let clientId: string
    beforeEach(async () => {
        fixture = await testStore()
        analytics = new AnalyticsStore(fixture.store, analyticsConfig())
        clientId = (
            await fixture.store.registerClient(
                "test",
                { kty: "EC", crv: "P-256", x: crypto.randomUUID(), y: "y" },
                { kty: "RSA", n: "n", e: "AQAB" }
            )
        ).id
    })
    afterEach(async () => {
        await fixture?.cleanup()
    })
    it("重复写入调用不会重复聚合，失败和翻译执行分开计数", async () => {
        const call = {
            id: "call-1",
            requestId: "r1",
            route: "/v1/translate",
            method: "POST",
            clientId,
            createdAt: new Date("2026-11-03T12:00:00Z"),
            completedAt: new Date("2026-11-03T12:00:00.100Z"),
            statusCode: 429,
            errorCode: "QUOTA_EXCEEDED",
            durationMs: 100
        }
        await Promise.all([
            analytics.recordCall(call),
            analytics.recordCall(call)
        ])
        expect(await fixture.store.db.apiCall.count()).toBe(1)
        const row = await fixture.store.db.analyticsDaily.findFirst({
            where: { dimension: "route" }
        })
        expect(row).toMatchObject({
            requests: 1n,
            successes: 0n,
            rejected: 1n,
            executions: 0n
        })
    })
    it("内容与额度预占同事务，失败回滚后不遗留内容", async () => {
        const epoch = await analytics.epoch(clientId)
        const data = {
            texts: ["Private software engineering"],
            sourceLanguage: "en",
            targetLanguage: "zh-CN"
        }
        await expect(
            fixture.store.reserveTranslation(
                clientId,
                28,
                [],
                data,
                async (tx, id) => {
                    await analytics.capture(tx, id, clientId, epoch, data.texts)
                    throw new Error("rollback")
                }
            )
        ).rejects.toThrow("rollback")
        expect(await fixture.store.db.translationContent.count()).toBe(0)
        const record = await fixture.store.reserveTranslation(
            clientId,
            28,
            [],
            data,
            (tx, id) => analytics.capture(tx, id, clientId, epoch, data.texts)
        )
        await fixture.store.finishTranslation(
            record.id,
            "success",
            5,
            2,
            {},
            tx =>
                analytics.complete(tx, record.id, clientId, epoch, ["私有内容"])
        )
        expect(await analytics.readContent(record.id)).toMatchObject({
            original: data.texts,
            translated: ["私有内容"]
        })
        const raw = JSON.stringify(
            await fixture.store.db.translationContent.findMany()
        )
        expect(raw).not.toContain("Private")
        expect(raw).not.toContain("私有内容")
        expect(await fixture.store.db.analysisJob.count()).toBe(1)
    })
    it("清理到期内容和明细不删除长期聚合", async () => {
        await analytics.recordCall({
            id: "old",
            requestId: "old",
            route: "/v1/usage",
            method: "POST",
            clientId,
            createdAt: new Date("2026-07-01T00:00:00Z"),
            completedAt: new Date("2026-07-01T00:00:01Z"),
            statusCode: 200,
            durationMs: 1000
        })
        await analytics.cleanup(Date.parse("2026-11-03T00:00:00Z"))
        expect(await fixture.store.db.apiCall.count()).toBe(0)
        expect(
            await fixture.store.db.analyticsDaily.count({
                where: { dimension: "route" }
            })
        ).toBe(1)
    })
})
