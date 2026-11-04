import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { loadConfig } from "../src/config.js"
import { clientDailyKey, translationBuckets } from "../src/limits.js"
import { testStore } from "./helpers.js"

describe("翻译额度错误分类", () => {
    let fixture: Awaited<ReturnType<typeof testStore>>
    let clientId: string
    const now = Date.parse("2026-11-04T01:00:00Z")
    beforeEach(async () => {
        fixture = await testStore()
        clientId = (
            await fixture.store.registerClient(
                "quota-test",
                { kty: "EC", crv: "P-256", x: crypto.randomUUID(), y: "y" },
                { kty: "RSA", n: "n", e: "AQAB" }
            )
        ).id
    })
    afterEach(async () => {
        await fixture?.cleanup()
    })
    const config = (extra: Record<string, string>) =>
        loadConfig({
            NODE_ENV: "test",
            SILICONFLOW_API_KEY: "fake",
            SILICONFLOW_MODEL: "fake",
            ...extra
        })

    it("默认每设备和IP每天50万字符，全站字符和次数均不设日上限", async () => {
        const settings = config({
            GLOBAL_DAILY_CHARACTERS: "0",
            GLOBAL_DAILY_REQUESTS: "0"
        })
        expect(settings.CLIENT_DAILY_CHARACTERS).toBe(500000)
        expect(settings.IP_DAILY_CHARACTERS).toBe(500000)
        const buckets = translationBuckets(
            settings,
            clientId,
            "same-ip",
            5,
            now
        )
        expect(
            buckets.filter(bucket => bucket.key.startsWith("global:"))
        ).toEqual([])
        await fixture.store.consumeBuckets([
            {
                key: `global:characters:${Math.floor(now / 86400000) * 86400000}`,
                amount: 2000000000,
                limit: 2000000000,
                expiresAt: new Date(now + 86400000)
            }
        ])
        await expect(
            fixture.store.reserveTranslation(clientId, 5, buckets)
        ).resolves.toMatchObject({ inputCharacters: 5 })
    })
    it.each(["client", "ip"])(
        "%s 每日额度允许恰好50万并拒绝再增加，其他额度完整回滚",
        async kind => {
            const settings = config({
                CLIENT_DAILY_CHARACTERS: kind === "ip" ? "600000" : "500000",
                IP_DAILY_CHARACTERS: "500000"
            })
            const initial = translationBuckets(
                settings,
                clientId,
                "same-ip",
                5,
                now
            )
            const daily = initial.find(
                bucket =>
                    bucket.key.startsWith(`${kind}:`) &&
                    bucket.key.includes(":day:")
            )!
            await fixture.store.consumeBuckets([{ ...daily, amount: 499995 }])
            await fixture.store.reserveTranslation(clientId, 5, initial)
            await expect(
                fixture.store.reserveTranslation(
                    clientId,
                    5,
                    translationBuckets(settings, clientId, "same-ip", 5, now)
                )
            ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" })
            expect(await fixture.store.used(daily.key)).toBe(500000)
            expect(await fixture.store.db.translationRequest.count()).toBe(1)
        }
    )

    it.each(["CLIENT_REQUESTS_PER_MINUTE", "IP_REQUESTS_PER_MINUTE"])(
        "%s 返回频率限制而不是今日额度耗尽，失败不扣字符额度",
        async setting => {
            const settings = config({ [setting]: "1" })
            const reserve = (time: number) =>
                fixture.store.reserveTranslation(
                    clientId,
                    5,
                    translationBuckets(settings, clientId, "same-ip", 5, time)
                )
            await reserve(now)
            await expect(reserve(now)).rejects.toMatchObject({
                status: 429,
                code: "RATE_LIMITED"
            })
            expect(
                await fixture.store.used(clientDailyKey(clientId, now))
            ).toBe(5)
            await expect(reserve(now + 60_000)).resolves.toMatchObject({
                inputCharacters: 5
            })
            expect(
                await fixture.store.used(clientDailyKey(clientId, now))
            ).toBe(10)
        }
    )
    it.each([
        ["CLIENT_DAILY_CHARACTERS", "5"],
        ["IP_DAILY_CHARACTERS", "5"],
        ["GLOBAL_DAILY_CHARACTERS", "5"],
        ["GLOBAL_DAILY_REQUESTS", "1"]
    ])("%s 仍返回每日额度耗尽，失败不重复计费", async (setting, limit) => {
        const settings = config({ [setting]: limit })
        const reserve = () =>
            fixture.store.reserveTranslation(
                clientId,
                5,
                translationBuckets(settings, clientId, "same-ip", 5, now)
            )
        await reserve()
        await expect(reserve()).rejects.toMatchObject({
            status: 429,
            code: "QUOTA_EXCEEDED"
        })
        expect(await fixture.store.used(clientDailyKey(clientId, now))).toBe(5)
        expect(await fixture.store.db.translationRequest.count()).toBe(1)
    })
})
