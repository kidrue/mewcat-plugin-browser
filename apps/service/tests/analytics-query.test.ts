import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { AnalyticsQuery, parseRange } from "../src/analytics/query.js"
import { AnalyticsStore } from "../src/analytics/store.js"
import { loadConfig } from "../src/config.js"
import { testStore } from "./helpers.js"

describe("画像查询和分页", () => {
    let fixture: Awaited<ReturnType<typeof testStore>>
    let analytics: AnalyticsStore
    let query: AnalyticsQuery
    const now = Date.parse("2026-11-04T12:00:00Z")
    beforeEach(async () => {
        fixture = await testStore()
        analytics = new AnalyticsStore(
            fixture.store,
            loadConfig({
                NODE_ENV: "test",
                SILICONFLOW_API_KEY: "fake",
                SILICONFLOW_MODEL: "fake"
            })
        )
        query = new AnalyticsQuery(analytics)
        for (const [id, clientId, route, statusCode, hour] of [
            ["a", "device-a", "/v1/translate", 200, 10],
            ["b", "device-a", "/v1/usage", 429, 10],
            ["c", "device-b", "/v1/usage", 200, 11]
        ] as const) {
            await analytics.recordCall({
                id,
                requestId: id,
                clientId,
                route,
                statusCode,
                method: "POST",
                createdAt: new Date(`2026-11-03T${hour}:00:00Z`),
                completedAt: new Date(`2026-11-03T${hour}:00:01Z`),
                durationMs: 1000,
                ...(statusCode === 429 ? { errorCode: "QUOTA_EXCEEDED" } : {})
            })
        }
    })
    afterEach(async () => {
        await fixture?.cleanup()
    })
    it("UTC 半开区间统计准确，匿名调用不计为活跃设备", async () => {
        const result = await query.summary(
            parseRange("2026-11-03", "2026-11-04", now),
            now
        )
        expect(result.totals).toMatchObject({
            requests: 3n,
            successes: 2n,
            failures: 1n
        })
        expect(result.activeDevices).toBe(2)
        expect(result.captureContent).toBe(false)
        expect(
            (
                await query.summary(
                    parseRange("2026-11-04", "2026-11-05", now),
                    now
                )
            ).totals.requests
        ).toBe(0n)
        expect(() => parseRange("2026-11-04", "2026-11-03")).toThrow()
    })
    it("复合游标翻页不遗漏相同时间记录，支持设备和结果过滤", async () => {
        const range = parseRange("2026-11-03", "2026-11-04", now)
        const first = await query.calls({ ...range, limit: 1 })
        const second = await query.calls({
            ...range,
            limit: 1,
            cursor: first.nextCursor!
        })
        expect(first.items[0]!.id).toBe("a")
        expect(second.items[0]!.id).toBe("b")
        expect(
            (
                await query.calls({
                    ...range,
                    clientId: "device-a",
                    outcome: "failed"
                })
            ).items.map(row => row.id)
        ).toEqual(["b"])
        await expect(
            query.calls({ ...range, cursor: "invalid" })
        ).rejects.toThrow()
    })
    it("原始记录清理后保留画像并标记明细覆盖不足", async () => {
        await fixture.store.db.client.create({
            data: {
                id: "device-a",
                name: "device",
                signingKey: "{}",
                encryptionKey: "{}",
                keyThumbprint: "test"
            }
        })
        const result = await query.profile("device-a", now)
        expect(result).toMatchObject({
            identityType: "device",
            last7Days: { requests: 2n },
            last30Days: { requests: 2n },
            activeHoursUtc: [{ hour: 10, requests: 2n }]
        })
        const future = Date.parse("2027-03-04T00:00:00Z")
        await analytics.cleanup(future)
        const summary = await query.summary(
            parseRange("2026-11-03", "2026-11-04", future),
            future
        )
        expect(summary.totals.requests).toBe(3n)
        expect(summary.p95DurationMs).toBeNull()
        expect(summary.coverage.callsComplete).toBe(false)
    })
})
