import { TranslationClient } from "@mewcat/client"
import { createIdentity, open, publicKeys, seal } from "@mewcat/protocol"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AnalyticsStore } from "../src/analytics/store.js"
import { buildApp } from "../src/app.js"
import { loadConfig } from "../src/config.js"
import { DeviceActivity } from "../src/device-activity.js"
import { testStore } from "./helpers.js"

const activityPath = "/v1/activity"
const analyticsPath = "/v1/analytics/activity"
const key = "a".repeat(64)
const otherKey = "b".repeat(64)

describe("设备活动加密接口", () => {
    let fixture: Awaited<ReturnType<typeof testStore>>
    let app: Awaited<ReturnType<typeof buildApp>>
    let server: Awaited<ReturnType<typeof createIdentity>>
    let config: ReturnType<typeof loadConfig>

    beforeAll(async () => {
        server = await createIdentity()
    })
    beforeEach(async () => {
        fixture = await testStore()
        config = loadConfig({
            NODE_ENV: "test",
            SILICONFLOW_API_KEY: "fake",
            SILICONFLOW_MODEL: "fake"
        })
        app = await buildApp({
            config,
            store: fixture.store,
            keys: {
                identity: server,
                publicKeys: await publicKeys(server, "server"),
                ipHashSecret: "test"
            }
        })
    })
    afterEach(async () => {
        await app?.close()
        await fixture?.cleanup()
    })

    async function client() {
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
        await sdk.register("活动测试设备")
        const { clientId, identity } = sdk.getState()
        return {
            id: clientId!,
            async call(path: string, data: unknown) {
                const payload = {
                    v: 1,
                    method: "POST",
                    path,
                    timestamp: Date.now(),
                    nonce: crypto.randomUUID(),
                    data
                }
                const envelope = await seal(
                    payload,
                    identity.signing.privateKey,
                    server.encryption.publicKey,
                    clientId!,
                    "server"
                )
                const response = await app.inject({
                    method: "POST",
                    url: path,
                    payload: { envelope }
                })
                const body = response.json()
                const result = body.envelope
                    ? await open(
                          body.envelope,
                          identity.encryption.privateKey,
                          server.signing.publicKey,
                          "server",
                          clientId!
                      )
                    : body
                return { status: response.statusCode, result }
            }
        }
    }

    it("仅统计授权设备，按日期与事件标识去重", async () => {
        const sdk = await client()
        const query = { operation: "profile", clientId: sdk.id }
        await expect(sdk.call(analyticsPath, query)).resolves.toMatchObject({
            status: 403
        })
        config.ANALYTICS_ADMIN_CLIENT_IDS.push(sdk.id)
        const eventId = crypto.randomUUID()
        const page = { operation: "page", pageKey: key, eventId, revision: 1 }
        await expect(sdk.call(activityPath, page)).resolves.toMatchObject({
            status: 200,
            result: {
                data: { enabled: false, uninstallPath: null, revision: 0 }
            }
        })
        await sdk.call(activityPath, {
            operation: "enable",
            newInstall: true,
            revision: 1
        })
        await sdk.call(activityPath, {
            operation: "enable",
            newInstall: true,
            revision: 1
        })
        await sdk.call(activityPath, page)
        const duplicate = crypto.randomUUID()
        await sdk.call(activityPath, { ...page, eventId: duplicate })
        await sdk.call(activityPath, { ...page, pageKey: otherKey })
        await sdk.call(activityPath, {
            ...page,
            pageKey: otherKey,
            eventId: duplicate
        })
        await expect(sdk.call(analyticsPath, query)).resolves.toMatchObject({
            status: 200,
            result: {
                data: {
                    installedAt: expect.any(String),
                    lastTranslationAt: expect.any(String),
                    pagesLast7: 1,
                    pagesLast30: 1
                }
            }
        })
        const rows = await fixture.store.db.deviceActivityPage.findMany()
        expect(rows).toHaveLength(2)
        expect(rows[0]?.pageKey).not.toBe(key)
        expect(
            await fixture.store.db.apiCall.count({
                where: { route: { in: [activityPath, analyticsPath] } }
            })
        ).toBe(0)
        await expect(
            sdk.call(analyticsPath, {
                operation: "overview",
                from: new Date().toISOString().slice(0, 10),
                to: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
            })
        ).resolves.toMatchObject({
            status: 200,
            result: {
                data: {
                    installs: 1,
                    uninstalls: 0,
                    activeDevices: 1,
                    firstTranslationDevices: 1,
                    pages: 1,
                    days: [{ pages: 1, activeDevices: 1 }]
                }
            }
        })
    })

    it("卸载链接只能使用一次，关闭统计会清除活动", async () => {
        const sdk = await client()
        config.ANALYTICS_ADMIN_CLIENT_IDS.push(sdk.id)
        const query = { operation: "profile", clientId: sdk.id }
        const { result } = await sdk.call(activityPath, {
            operation: "enable",
            newInstall: false,
            revision: 1
        })
        expect(result).toMatchObject({
            data: {
                enabled: true,
                uninstallPath: expect.stringMatching(
                    /^\/v1\/activity\/uninstall(?:\?|\/)/
                )
            }
        })
        const { uninstallPath } = (
            result as { data: { uninstallPath: string } }
        ).data
        const uninstall = () =>
            app.inject({ method: "GET", url: uninstallPath })
        expect(
            (await app.inject({ method: "HEAD", url: uninstallPath }))
                .statusCode
        ).toBe(404)
        expect((await uninstall()).statusCode).toBe(204)
        const first = await sdk.call(analyticsPath, query)
        expect(first).toMatchObject({
            result: {
                data: { installedAt: null, uninstalledAt: expect.any(String) }
            }
        })
        expect((await uninstall()).statusCode).toBe(204)
        expect((await sdk.call(analyticsPath, query)).result).toMatchObject({
            data: (first.result as { data: object }).data
        })
        await sdk.call(activityPath, { operation: "disable", revision: 2 })
        expect((await uninstall()).statusCode).toBe(204)
        await expect(sdk.call(analyticsPath, query)).resolves.toMatchObject({
            status: 200,
            result: {
                data: {
                    installedAt: null,
                    uninstalledAt: null,
                    lastTranslationAt: null,
                    pagesLast7: 0,
                    pagesLast30: 0
                }
            }
        })
    })

    it("跨日区间按设备和页面去重，超过保留期后清理明细", async () => {
        const sdk = await client()
        const activity = new DeviceActivity(fixture.store, "test", 2)
        const day1 = Date.parse("2026-11-23T12:00:00Z")
        const day2 = Date.parse("2026-11-24T12:00:00Z")
        const day3 = Date.parse("2026-11-25T12:00:00Z")
        await activity.report(
            sdk.id,
            { operation: "enable", newInstall: true, revision: 1 },
            day1
        )
        const page = {
            operation: "page" as const,
            pageKey: key,
            eventId: crypto.randomUUID(),
            revision: 1
        }
        await activity.report(sdk.id, page, day1)
        await activity.report(sdk.id, { ...page, pageKey: otherKey }, day2)
        await activity.report(
            sdk.id,
            { ...page, eventId: crypto.randomUUID() },
            day2
        )
        const lastTranslation = day2 + 60_000
        const sameDayRepeat = { ...page, eventId: crypto.randomUUID() }
        await activity.report(sdk.id, sameDayRepeat, lastTranslation)
        await activity.report(sdk.id, sameDayRepeat, day3)
        await expect(
            activity.query(
                { operation: "overview", from: "2026-11-23", to: "2026-11-25" },
                day2
            )
        ).resolves.toMatchObject({
            pages: 1,
            activeDevices: 1,
            firstTranslationDevices: 1,
            days: [
                { pages: 1, firstTranslationDevices: 1 },
                { pages: 1, firstTranslationDevices: 0 }
            ]
        })
        await activity.cleanup(day3)
        expect(await fixture.store.db.deviceActivityPage.count()).toBe(2)
        await expect(
            activity.query({ operation: "profile", clientId: sdk.id }, day3)
        ).resolves.toMatchObject({
            pagesLast7: 1,
            pagesLast30: 1,
            lastTranslationAt: new Date(lastTranslation).toISOString()
        })
    })

    it("管理员清除画像时撤销卸载链接并清除活动记录", async () => {
        const sdk = await client()
        const activity = new DeviceActivity(fixture.store, "test", 90)
        const { uninstallPath } = await activity.report(sdk.id, {
            operation: "enable",
            newInstall: true,
            revision: 1
        })
        await activity.report(sdk.id, {
            operation: "page",
            pageKey: key,
            eventId: crypto.randomUUID(),
            revision: 1
        })
        const analytics = new AnalyticsStore(fixture.store, config)
        await analytics.purge(sdk.id)
        expect(await fixture.store.db.deviceActivity.count()).toBe(0)
        expect(await fixture.store.db.deviceActivityPage.count()).toBe(0)
        expect(
            (await app.inject({ method: "GET", url: uninstallPath! }))
                .statusCode
        ).toBe(204)
        expect(await fixture.store.db.deviceActivity.count()).toBe(0)
        await expect(
            activity.report(sdk.id, {
                operation: "enable",
                newInstall: true,
                revision: 1
            })
        ).resolves.toMatchObject({ enabled: false, revision: 2 })
    })

    it("设备列表纳入只有页面或卸载活动的设备并保留分页和筛选", async () => {
        const browser = await client()
        const removed = await client()
        config.ANALYTICS_ADMIN_CLIENT_IDS.push(browser.id)
        const activity = new DeviceActivity(fixture.store, "test", 90)
        const twoDaysAgo = Date.now() - 2 * 86_400_000
        const yesterday = Date.now() - 86_400_000
        const from = new Date(twoDaysAgo).toISOString().slice(0, 10)
        const to = new Date(yesterday).toISOString().slice(0, 10)
        await activity.report(
            browser.id,
            { operation: "enable", newInstall: false, revision: 1 },
            twoDaysAgo
        )
        await activity.report(
            browser.id,
            {
                operation: "page",
                pageKey: key,
                eventId: crypto.randomUUID(),
                revision: 1
            },
            twoDaysAgo
        )
        const { uninstallPath } = await activity.report(
            removed.id,
            {
                operation: "enable",
                newInstall: false,
                revision: 1
            },
            twoDaysAgo
        )
        await activity.uninstall(uninstallPath!.split("/").at(-1)!, twoDaysAgo)

        const input = { operation: "devices", from, to, limit: 1 }
        const { result } = await browser.call("/v1/analytics/query", input)
        const [firstId, nextId] = [browser.id, removed.id].sort()
        expect(result).toMatchObject({
            data: {
                items: [
                    {
                        client: { id: firstId },
                        requests: "0",
                        characters: "0",
                        lastObservedDay: from
                    }
                ],
                nextCursor: expect.any(String)
            }
        })
        const { nextCursor } = (result as { data: { nextCursor: string } }).data
        await expect(
            browser.call("/v1/analytics/query", {
                ...input,
                cursor: nextCursor
            })
        ).resolves.toMatchObject({
            result: {
                data: {
                    items: [{ client: { id: nextId }, requests: "0" }],
                    nextCursor: null
                }
            }
        })
        await expect(
            browser.call("/v1/analytics/query", {
                ...input,
                clientId: removed.id
            })
        ).resolves.toMatchObject({
            result: {
                data: {
                    items: [{ client: { id: removed.id }, requests: "0" }],
                    nextCursor: null
                }
            }
        })
    })

    it("拒绝在撤回之后送达的旧授权，并隔离重新授权前的旧页面", async () => {
        const sdk = await client()
        const activity = new DeviceActivity(fixture.store, "test", 90)
        const disabled = { operation: "disable", revision: 2 } as const
        const firstEnable = {
            operation: "enable",
            newInstall: true,
            revision: 1
        } as const
        const nextEnable = { ...firstEnable, revision: 3 }
        const page = {
            operation: "page",
            pageKey: key,
            eventId: crypto.randomUUID(),
            revision: 1
        } as const

        await activity.report(sdk.id, disabled)
        await expect(
            activity.report(sdk.id, firstEnable)
        ).resolves.toMatchObject({ enabled: false, revision: 2 })
        const { uninstallPath } = await activity.report(sdk.id, nextEnable)
        await activity.report(sdk.id, disabled)
        await expect(activity.report(sdk.id, page)).resolves.toMatchObject({
            enabled: false,
            revision: 3
        })
        await expect(
            activity.report(sdk.id, { ...page, revision: 3 })
        ).resolves.toMatchObject({ enabled: true, revision: 3 })
        expect(await fixture.store.db.deviceActivityPage.count()).toBe(1)
        await activity.uninstall(uninstallPath!.split("/").at(-1)!)
        await expect(
            activity.report(sdk.id, nextEnable)
        ).resolves.toMatchObject({ enabled: false, revision: 3 })
    })
})
