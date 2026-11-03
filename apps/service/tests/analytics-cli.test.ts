import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { runAnalyticsCli } from "../scripts/analytics.js"
import { AnalyticsStore } from "../src/analytics/store.js"
import { loadConfig } from "../src/config.js"
import { testStore } from "./helpers.js"

describe("画像管理 CLI", () => {
    let fixture: Awaited<ReturnType<typeof testStore>>
    let analytics: AnalyticsStore
    let output: string
    beforeEach(async () => {
        fixture = await testStore()
        analytics = new AnalyticsStore(
            fixture.store,
            loadConfig({
                NODE_ENV: "test",
                SILICONFLOW_API_KEY: "fake",
                SILICONFLOW_MODEL: "fake",
                ANALYTICS_CAPTURE_CONTENT: "true",
                ANALYTICS_CONTENT_KEY: Buffer.alloc(32, 7).toString("base64")
            })
        )
        output = ""
    })
    afterEach(async () => {
        await fixture?.cleanup()
    })
    const write = (text: string) => {
        output += text
    }
    it("导出默认无内容，显式内容导出要求文件且拒绝覆盖", async () => {
        const clientId = (
            await fixture.store.registerClient(
                "test",
                { kty: "EC", crv: "P-256", x: "cli", y: "y" },
                { kty: "RSA", n: "n", e: "AQAB" }
            )
        ).id
        const epoch = await analytics.epoch(clientId)
        const record = await fixture.store.reserveTranslation(
            clientId,
            6,
            [],
            {},
            (tx, id) => analytics.capture(tx, id, clientId, epoch, ["secret"])
        )
        const now = new Date()
        await analytics.recordCall({
            id: "export",
            requestId: "export",
            clientId,
            route: "/v1/translate",
            method: "POST",
            createdAt: now,
            completedAt: now,
            durationMs: 1,
            statusCode: 200,
            translationRequestId: record.id
        })
        await runAnalyticsCli(["export"], analytics, write)
        expect(output).not.toContain("secret")
        expect(JSON.parse(output).translationRequestId).toBe(record.id)
        await expect(
            runAnalyticsCli(["export", "--include-content"], analytics, write)
        ).rejects.toThrow()
        // 使用测试数据库同目录，清理随 fixture 进行。
        const files = await fixture.store.db.$queryRawUnsafe<
            Array<{ file: string }>
        >("PRAGMA database_list")
        const path = join(files[0]!.file, "..", "export.jsonl")
        await runAnalyticsCli(
            ["export", "--include-content", "--output", path],
            analytics,
            write
        )
        expect(
            JSON.parse(await readFile(path, "utf8")).content.original
        ).toEqual(["secret"])
        await expect(
            runAnalyticsCli(["export", "--output", path], analytics, write)
        ).rejects.toThrow()
    })
    it("无效操作参数在修改数据前拒绝，统计支持大整数", async () => {
        await expect(
            runAnalyticsCli(["purge"], analytics, write)
        ).rejects.toThrow()
        await expect(
            runAnalyticsCli(["analyze", "--limit", "0"], analytics, write)
        ).rejects.toThrow()
        await expect(
            runAnalyticsCli(["calls", "--outcome", "invalid"], analytics, write)
        ).rejects.toThrow()
        await expect(
            runAnalyticsCli(
                ["purge", "device", "--from", "2026-11-01"],
                analytics,
                write
            )
        ).rejects.toThrow()
        await expect(
            runAnalyticsCli(["retry", "--client", "device"], analytics, write)
        ).rejects.toThrow()
        await expect(
            runAnalyticsCli(["analyze", "--client", "device"], analytics, write)
        ).rejects.toThrow()
        await expect(
            runAnalyticsCli(
                ["profile", "device", "--from", "2026-11-01"],
                analytics,
                write
            )
        ).rejects.toThrow()
        await runAnalyticsCli(["summary"], analytics, write)
        expect(JSON.parse(output)).toMatchObject({
            totals: { requests: "0" },
            captureContent: true,
            autoAnalyze: false
        })
    })
})
