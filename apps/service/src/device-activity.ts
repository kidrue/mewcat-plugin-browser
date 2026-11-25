import { createHash, createHmac, randomBytes } from "node:crypto"
import {
    DEVICE_ACTIVITY_UNINSTALL_PATH,
    type DeviceActivityAnalytics,
    type DeviceActivityInput,
    type DeviceActivityQuery,
    type DeviceActivityResult
} from "@mewcat/protocol"

import { DAY_MS, utcDay } from "./analytics/store.js"
import { ApiError } from "./errors.js"
import { Prisma } from "./generated/prisma/client.js"
import type { Store } from "./store.js"

const uninstallTokenPattern = /^[A-Za-z0-9_-]{43}$/
const tokenHash = (token: string) =>
    createHash("sha256").update(token).digest("hex")
const startDay = (now: number, days: number) =>
    utcDay(now - (days - 1) * DAY_MS)
const maxRetentionDays = 90

export function retainedActivityRange(
    range: { from: string; to: string },
    now: number,
    retentionDays: number
) {
    const firstRetained = startDay(
        now,
        Math.min(retentionDays, maxRetentionDays)
    )
    const tomorrow = utcDay(now + DAY_MS)
    return {
        from: range.from > firstRetained ? range.from : firstRetained,
        to: range.to < tomorrow ? range.to : tomorrow
    }
}

interface DayPageCounts {
    day: string
    activeDevices: bigint
    pages: bigint
}
interface LifecycleCounts {
    day: string
    kind: "installs" | "uninstalls" | "firstTranslationDevices"
    count: bigint
}
type Overview = Extract<DeviceActivityAnalytics, { operation: "overview" }>

export class DeviceActivity {
    private readonly retentionDays: number
    constructor(
        private readonly store: Store,
        private readonly secret: string,
        retentionDays: number
    ) {
        this.retentionDays = Math.min(retentionDays, maxRetentionDays)
    }

    async report(
        clientId: string,
        input: DeviceActivityInput,
        now = Date.now()
    ): Promise<DeviceActivityResult> {
        return this.store.atomic(async tx => {
            const client = await tx.client.findUnique({
                where: { id: clientId },
                select: {
                    activityRevision: true,
                    revokedAt: true,
                    activity: {
                        select: {
                            enabled: true,
                            installedAt: true,
                            firstTranslationAt: true,
                            lastTranslationAt: true
                        }
                    }
                }
            })
            if (!client)
                throw new ApiError(401, "UNAUTHORIZED", "客户端身份无效")
            if (client.revokedAt)
                throw new ApiError(403, "CLIENT_REVOKED", "客户端已被停用")

            const { activityRevision, activity: state } = client
            const { revision } = input
            const disabled = {
                enabled: false,
                uninstallPath: null,
                revision: activityRevision
            }
            if (revision < activityRevision)
                return input.operation === "disable"
                    ? { ...disabled, enabled: state?.enabled ?? false }
                    : disabled

            // 版本保留在现有设备身份上，删除活动后仍可拒绝迟到的授权。
            if (input.operation !== "page" && revision > activityRevision)
                await tx.client.update({
                    where: { id: clientId },
                    data: { activityRevision: revision }
                })

            if (input.operation === "disable") {
                await tx.deviceActivity.deleteMany({ where: { clientId } })
                return { ...disabled, revision }
            }

            if (input.operation === "enable") {
                if (revision === activityRevision && !state?.enabled)
                    return disabled
                const token = randomBytes(32).toString("base64url")
                const data = {
                    enabled: true,
                    uninstallTokenHash: tokenHash(token),
                    installedAt:
                        state?.installedAt ??
                        (revision > activityRevision && input.newInstall
                            ? new Date(now)
                            : null)
                }
                await tx.deviceActivity.upsert({
                    where: { clientId },
                    create: { clientId, ...data },
                    update: data
                })
                return {
                    enabled: true,
                    uninstallPath: `${DEVICE_ACTIVITY_UNINSTALL_PATH}/${token}`,
                    revision
                }
            }

            if (!state?.enabled || revision !== activityRevision)
                return disabled
            const enabled = { enabled: true, uninstallPath: null, revision }
            const { eventId } = input
            const receipt = await tx.deviceActivityPage.findUnique({
                where: { clientId_eventId: { clientId, eventId } }
            })
            if (receipt) return enabled

            const day = utcDay(now)
            const pageKey = createHmac("sha256", this.secret)
                .update(
                    JSON.stringify([
                        "mewcat-activity-page-v1",
                        clientId,
                        input.pageKey
                    ])
                )
                .digest("hex")
            const counted = await tx.deviceActivityPage.findUnique({
                where: { clientId_day_pageKey: { clientId, day, pageKey } }
            })
            // 重复页面也记录事件标识，使其重试不会在次日重新计数。
            await tx.deviceActivityPage.create({
                data: {
                    clientId,
                    eventId,
                    day,
                    pageKey: counted ? null : pageKey
                }
            })
            await tx.deviceActivity.update({
                where: { clientId },
                data: {
                    firstTranslationAt:
                        state.firstTranslationAt ?? new Date(now),
                    lastTranslationAt: new Date(
                        Math.max(state.lastTranslationAt?.getTime() ?? now, now)
                    )
                }
            })
            return enabled
        })
    }

    async uninstall(token: string, now = Date.now()): Promise<void> {
        if (!uninstallTokenPattern.test(token)) return
        await this.store.atomic(async tx => {
            const state = await tx.deviceActivity.findUnique({
                where: { uninstallTokenHash: tokenHash(token) },
                select: { clientId: true, enabled: true, uninstalledAt: true }
            })
            if (!state?.enabled) return
            await tx.deviceActivity.update({
                where: { clientId: state.clientId },
                data: {
                    enabled: false,
                    uninstallTokenHash: null,
                    uninstalledAt: state.uninstalledAt ?? new Date(now)
                }
            })
        })
    }

    async cleanup(now = Date.now()): Promise<void> {
        const cutoff = startDay(now, this.retentionDays)
        await this.store.atomic(async tx => {
            await tx.deviceActivityPage.deleteMany({
                where: { day: { lt: cutoff } }
            })
            await tx.deviceActivity.deleteMany({
                where: {
                    enabled: false,
                    uninstalledAt: { lt: new Date(cutoff) }
                }
            })
        })
    }

    async query(
        input: DeviceActivityQuery,
        now = Date.now()
    ): Promise<DeviceActivityAnalytics> {
        if (input.operation === "profile")
            return this.profile(input.clientId, now)
        const { from, to } = retainedActivityRange(
            input,
            now,
            this.retentionDays
        )
        const days: Overview["days"] = []
        const totals = {
            installs: 0,
            uninstalls: 0,
            activeDevices: 0,
            firstTranslationDevices: 0,
            pages: 0
        }
        if (from >= to) return { operation: "overview", ...totals, days }

        const db = this.store.db
        const pagesInRange = Prisma.sql`
            FROM "DeviceActivityPage"
            WHERE "day" >= ${from} AND "day" < ${to} AND "pageKey" IS NOT NULL
        `
        const [period] = await db.$queryRaw<
            { activeDevices: bigint; pages: bigint }[]
        >`
            SELECT COUNT(DISTINCT "clientId") AS "activeDevices", COUNT(*) AS "pages"
            FROM (SELECT DISTINCT "clientId", "pageKey" ${pagesInRange})
        `
        const byDay = await db.$queryRaw<DayPageCounts[]>`
            SELECT "day", COUNT(DISTINCT "clientId") AS "activeDevices", COUNT(*) AS "pages"
            ${pagesInRange}
            GROUP BY "day"
        `
        const fromTime = new Date(from)
        const toTime = new Date(to)
        const lifecycle = await db.$queryRaw<LifecycleCounts[]>`
            SELECT substr("installedAt", 1, 10) AS "day", 'installs' AS "kind", COUNT(*) AS "count"
            FROM "DeviceActivity" WHERE "installedAt" >= ${fromTime} AND "installedAt" < ${toTime}
            GROUP BY "day"
            UNION ALL
            SELECT substr("uninstalledAt", 1, 10) AS "day", 'uninstalls' AS "kind", COUNT(*) AS "count"
            FROM "DeviceActivity" WHERE "uninstalledAt" >= ${fromTime} AND "uninstalledAt" < ${toTime}
            GROUP BY "day"
            UNION ALL
            SELECT substr("firstTranslationAt", 1, 10) AS "day", 'firstTranslationDevices' AS "kind", COUNT(*) AS "count"
            FROM "DeviceActivity" WHERE "firstTranslationAt" >= ${fromTime} AND "firstTranslationAt" < ${toTime}
            GROUP BY "day"
        `
        for (
            let time = Date.parse(from);
            time < Date.parse(to);
            time += DAY_MS
        ) {
            const day = utcDay(time)
            const pageCounts = byDay.find(row => row.day === day)
            const values = {
                day,
                installs: 0,
                uninstalls: 0,
                firstTranslationDevices: 0,
                activeDevices: Number(pageCounts?.activeDevices ?? 0),
                pages: Number(pageCounts?.pages ?? 0)
            }
            for (const row of lifecycle.filter(row => row.day === day)) {
                values[row.kind] = Number(row.count)
                totals[row.kind] += values[row.kind]
            }
            days.push(values)
        }
        return {
            operation: "overview",
            ...totals,
            activeDevices: Number(period?.activeDevices ?? 0),
            pages: Number(period?.pages ?? 0),
            days
        }
    }

    private async profile(
        clientId: string,
        now: number
    ): Promise<DeviceActivityAnalytics> {
        const db = this.store.db
        const client = await db.client.findUnique({
            where: { id: clientId },
            select: {
                activity: {
                    select: {
                        installedAt: true,
                        uninstalledAt: true,
                        lastTranslationAt: true
                    }
                }
            }
        })
        if (!client)
            throw new ApiError(404, "ANALYTICS_DEVICE_NOT_FOUND", "设备不存在")
        const thirtyDays = startDay(now, Math.min(this.retentionDays, 30))
        const sevenDays = startDay(now, Math.min(this.retentionDays, 7))
        const today = utcDay(now)
        const [counts] = await db.$queryRaw<
            { pagesLast7: bigint; pagesLast30: bigint }[]
        >`
            SELECT
                COUNT(DISTINCT CASE WHEN "day" >= ${sevenDays} THEN "pageKey" END) AS "pagesLast7",
                COUNT(DISTINCT "pageKey") AS "pagesLast30"
            FROM "DeviceActivityPage"
            WHERE "clientId" = ${clientId} AND "day" >= ${thirtyDays} AND "day" <= ${today}
        `
        return {
            operation: "profile",
            installedAt: client.activity?.installedAt?.toISOString() ?? null,
            uninstalledAt:
                client.activity?.uninstalledAt?.toISOString() ?? null,
            lastTranslationAt:
                client.activity?.lastTranslationAt?.toISOString() ?? null,
            pagesLast7: Number(counts?.pagesLast7 ?? 0),
            pagesLast30: Number(counts?.pagesLast30 ?? 0)
        }
    }
}
