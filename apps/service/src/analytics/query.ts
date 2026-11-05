import { Prisma } from "../generated/prisma/client.js"
import { queryCheckpoint } from "./cancellation.js"
import {
    ANALYSIS_VERSION,
    DAY_MS,
    utcDay,
    type AnalyticsStore
} from "./store.js"

export interface Range {
    from: Date
    to: Date
}
export function parseRange(
    from?: string,
    to?: string,
    now = Date.now()
): Range {
    const parse = (value: string) => {
        if (
            !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(
                value
            )
        )
            throw new Error("时间必须为 UTC 日期或 ISO 时间")
        const date = new Date(value)
        if (
            !Number.isFinite(date.getTime()) ||
            (value.length === 10 && utcDay(date) !== value)
        )
            throw new Error("无效时间")
        return date
    }
    const end = to
        ? parse(to)
        : new Date(Date.parse(`${utcDay(now)}T00:00:00Z`) + DAY_MS)
    const start = from ? parse(from) : new Date(end.getTime() - 30 * DAY_MS)
    if (start >= end) throw new Error("开始时间必须早于结束时间")
    return { from: start, to: end }
}
const sums = {
    requests: true,
    successes: true,
    failures: true,
    rejected: true,
    executions: true,
    characters: true,
    promptTokens: true,
    completionTokens: true,
    durationMs: true
} as const
const empty = () => ({
    requests: 0n,
    successes: 0n,
    failures: 0n,
    rejected: 0n,
    executions: 0n,
    characters: 0n,
    promptTokens: 0n,
    completionTokens: 0n,
    durationMs: 0
})
function total(
    rows: Array<{
        _sum: Partial<{
            [K in keyof ReturnType<typeof empty>]:
                | ReturnType<typeof empty>[K]
                | null
        }>
    }>
) {
    const result = empty()
    for (const row of rows)
        for (const key of Object.keys(result) as Array<keyof typeof result>) {
            if (key === "durationMs")
                result.durationMs += row._sum.durationMs ?? 0
            else result[key] += row._sum[key] ?? 0n
        }
    return {
        ...result,
        successRate: result.requests
            ? Number(result.successes) / Number(result.requests)
            : null,
        averageDurationMs: result.requests
            ? result.durationMs / Number(result.requests)
            : null,
        averageTranslationCharacters: result.executions
            ? Number(result.characters) / Number(result.executions)
            : null
    }
}

export interface CallFilter extends Range {
    signal?: AbortSignal
    routes?: readonly string[]
    clientId?: string
    route?: string
    outcome?: "success" | "failed" | "rejected"
    cursor?: string
    limit?: number
}

export class AnalyticsQuery {
    constructor(readonly analytics: AnalyticsStore) {}
    private days(range: Range) {
        if (
            range.from.toISOString().slice(11) !== "00:00:00.000Z" ||
            range.to.toISOString().slice(11) !== "00:00:00.000Z"
        )
            throw new Error("聚合统计时间必须为 UTC 零点，避免部分日期重复计入")
        return { gte: utcDay(range.from), lt: utcDay(range.to) }
    }
    async summary(
        range: Range,
        now = Date.now(),
        clientId?: string,
        route?: string,
        signal?: AbortSignal
    ) {
        await queryCheckpoint(signal)
        const db = this.analytics.store.db
        const where = {
            day: this.days(range),
            dimension: "route",
            ...(route ? { value: route } : {}),
            ...(clientId ? { clientId } : {})
        }
        const rows = await db.analyticsDaily.groupBy({
            by: ["value"],
            where,
            _sum: sums
        })
        await queryCheckpoint(signal)
        const totals = total(rows)
        const active = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
            SELECT COUNT(DISTINCT "clientId") AS "count" FROM "AnalyticsDaily"
            WHERE "dimension" = 'route' AND "day" >= ${utcDay(range.from)} AND "day" < ${utcDay(range.to)} AND "clientId" <> ''
            ${clientId ? Prisma.sql`AND "clientId" = ${clientId}` : Prisma.empty}
            ${route ? Prisma.sql`AND "value" = ${route}` : Prisma.empty}
        `)
        await queryCheckpoint(signal)
        const jobs = await db.analysisJob.groupBy({
            by: ["status"],
            where: {
                createdAt: { gte: range.from, lt: range.to },
                ...(clientId ? { clientId } : {})
            },
            _count: true
        })
        await queryCheckpoint(signal)
        const completed = await db.contentAnalysis.count({
            where: {
                requestCreatedAt: { gte: range.from, lt: range.to },
                version: ANALYSIS_VERSION,
                ...(clientId ? { clientId } : {})
            }
        })
        await queryCheckpoint(signal)
        const analysisDetailsComplete =
            range.from.getTime() >=
            now - this.analytics.config.ANALYTICS_CALL_RETENTION_DAYS * DAY_MS
        const callsComplete =
            range.from.getTime() >=
            now - this.analytics.config.ANALYTICS_CALL_RETENTION_DAYS * DAY_MS
        const aggregateComplete =
            range.from.getTime() >=
            Date.parse(
                `${utcDay(now - this.analytics.config.ANALYTICS_AGGREGATE_RETENTION_DAYS * DAY_MS)}T00:00:00Z`
            )
        let p95DurationMs: number | null = null
        let p95UnavailableReason: string | null = callsComplete
            ? null
            : "outside-call-retention"
        if (callsComplete) {
            const callWhere = {
                ...(route ? { route } : {}),
                createdAt: { gte: range.from, lt: range.to },
                ...(clientId ? { clientId } : {})
            }
            const count = await db.apiCall.count({ where: callWhere })
            await queryCheckpoint(signal)
            if (count && count <= 100_000) {
                const durations = await db.apiCall.findMany({
                    where: callWhere,
                    select: { durationMs: true },
                    orderBy: { durationMs: "asc" },
                    skip: Math.ceil(count * 0.95) - 1,
                    take: 1
                })
                p95DurationMs = durations[0]?.durationMs ?? null
            } else
                p95UnavailableReason = count ? "too-many-calls" : "no-samples"
        }
        await queryCheckpoint(signal)
        const first = await db.analyticsDaily.findFirst({
            where: {
                dimension: "route",
                ...(route ? { value: route } : {}),
                ...(clientId ? { clientId } : {})
            },
            orderBy: { day: "asc" },
            select: { day: true }
        })
        await queryCheckpoint(signal)
        return {
            from: range.from.toISOString(),
            to: range.to.toISOString(),
            asOf: new Date(now).toISOString(),
            totals,
            activeDevices: Number(active[0]?.count ?? 0n),
            routes: rows.map(row => ({ route: row.value, ...row._sum })),
            p95DurationMs,
            p95UnavailableReason,
            captureContent: this.analytics.config.ANALYTICS_CAPTURE_CONTENT,
            autoAnalyze: this.analytics.config.ANALYTICS_AUTO_ANALYZE,
            analysisVersion: ANALYSIS_VERSION,
            analysis: {
                completedInRetainedDetails: completed,
                jobs: Object.fromEntries(
                    jobs.map(row => [row.status, row._count])
                ),
                coverageOfExecutions:
                    analysisDetailsComplete &&
                    aggregateComplete &&
                    totals.executions &&
                    BigInt(completed) <= totals.executions
                        ? completed / Number(totals.executions)
                        : null,
                detailsComplete: analysisDetailsComplete,
                timeBasis: "translation-request-time"
            },
            coverage: {
                callsComplete,
                aggregateComplete,
                earliestObservedDay: first?.day ?? null,
                observationScope: "received-by-this-backend",
                tokenTotals: "reported-usage-only; missing-usage-is-unknown"
            }
        }
    }
    async profile(clientId: string, now = Date.now(), signal?: AbortSignal) {
        await queryCheckpoint(signal)
        const db = this.analytics.store.db
        const client = await db.client.findUnique({
            where: { id: clientId },
            select: { id: true, name: true, createdAt: true, revokedAt: true }
        })
        if (!client) throw new Error("设备不存在")
        const range = parseRange(undefined, undefined, now)
        const week = {
            from: new Date(range.to.getTime() - 7 * DAY_MS),
            to: range.to
        }
        const last30 = await this.summary(
            range,
            now,
            clientId,
            undefined,
            signal
        )
        const last7 = await this.summary(week, now, clientId, undefined, signal)
        const dims = await db.analyticsDaily.groupBy({
            by: ["dimension", "value"],
            where: {
                clientId,
                day: this.days(range),
                dimension: { in: ["hour", "language", "error"] }
            },
            _sum: { requests: true, characters: true }
        })
        await queryCheckpoint(signal)
        const topics = await db.topicDaily.groupBy({
            by: ["topic"],
            where: {
                clientId,
                day: this.days(range),
                version: ANALYSIS_VERSION
            },
            _sum: { samples: true, score: true }
        })
        await queryCheckpoint(signal)
        const score = topics.reduce(
            (sum, row) => sum + (row._sum.score ?? 0),
            0
        )
        const activeDays = await db.analyticsDaily.groupBy({
            by: ["day"],
            where: { clientId, day: this.days(range), dimension: "route" }
        })
        await queryCheckpoint(signal)
        const first = await db.analyticsDaily.findFirst({
            where: { clientId, dimension: "route" },
            orderBy: { day: "asc" }
        })
        await queryCheckpoint(signal)
        const last = await db.apiCall.findFirst({
            where: { clientId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
        })
        await queryCheckpoint(signal)
        const lastDay = await db.analyticsDaily.findFirst({
            where: { clientId, dimension: "route" },
            orderBy: { day: "desc" },
            select: { day: true }
        })
        await queryCheckpoint(signal)
        const analyses = await db.contentAnalysis.findMany({
            where: {
                clientId,
                version: ANALYSIS_VERSION,
                requestCreatedAt: { gte: range.from, lt: range.to }
            },
            select: { keywords: true },
            take: 10_000
        })
        await queryCheckpoint(signal)
        const keywordCounts = new Map<string, number>()
        for (const row of analyses)
            for (const keyword of new Set(JSON.parse(row.keywords) as string[]))
                keywordCounts.set(
                    keyword,
                    (keywordCounts.get(keyword) ?? 0) + 1
                )
        return {
            identityType: "device",
            client,
            firstObservedDayInRetention: first?.day ?? null,
            lastObservedDayInRetention: lastDay?.day ?? null,
            lastObservedCallInRetention: last?.createdAt ?? null,
            last7Days: last7.totals,
            last30Days: last30.totals,
            activeDaysLast30: activeDays.length,
            activeDaysLast7: activeDays.filter(
                row => row.day >= utcDay(week.from)
            ).length,
            averageDailyCallsLast30: Number(last30.totals.requests) / 30,
            activeHoursUtc: dims
                .filter(row => row.dimension === "hour")
                .map(row => ({
                    hour: Number(row.value),
                    requests: row._sum.requests ?? 0n
                }))
                .sort((a, b) => a.hour - b.hour),
            languages: dims
                .filter(row => row.dimension === "language")
                .map(row => ({
                    languagePair: JSON.parse(row.value) as [string, string],
                    requests: row._sum.requests ?? 0n,
                    characters: row._sum.characters ?? 0n
                })),
            errors: dims
                .filter(row => row.dimension === "error")
                .map(row => ({
                    code: row.value,
                    requests: row._sum.requests ?? 0n
                })),
            recentContentInterests: topics
                .map(row => ({
                    topic: row.topic,
                    samples: row._sum.samples ?? 0n,
                    score: row._sum.score ?? 0,
                    share: score ? (row._sum.score ?? 0) / score : null
                }))
                .sort((a, b) => b.score - a.score),
            recentKeywords: [...keywordCounts]
                .map(([keyword, samples]) => ({ keyword, samples }))
                .sort((a, b) => b.samples - a.samples)
                .slice(0, 20),
            keywordAnalysisSampleLimit: 10_000,
            interestMeaning:
                "近期翻译内容的主题倾向；模型自报置信度，不代表用户身份或自述",
            analysisVersion: ANALYSIS_VERSION,
            analysis: last30.analysis,
            coverage: last30.coverage,
            captureContent: last30.captureContent,
            autoAnalyze: last30.autoAnalyze
        }
    }
    async calls(filter: CallFilter) {
        await queryCheckpoint(filter.signal)
        const limit = filter.limit ?? 100
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
            throw new Error("limit 必须为 1–1000 的整数")
        let cursor: { at: Date; id: string } | undefined
        if (filter.cursor) {
            try {
                const parsed: unknown = JSON.parse(
                    Buffer.from(filter.cursor, "base64url").toString("utf8")
                )
                if (
                    !Array.isArray(parsed) ||
                    parsed.length !== 2 ||
                    typeof parsed[0] !== "string" ||
                    typeof parsed[1] !== "string" ||
                    parsed[1].length > 100
                )
                    throw new Error()
                cursor = { at: new Date(parsed[0]), id: parsed[1] }
                if (!Number.isFinite(cursor.at.getTime())) throw new Error()
            } catch {
                throw new Error("无效分页游标")
            }
        }
        const where: Prisma.ApiCallWhereInput = {
            createdAt: { gte: filter.from, lt: filter.to },
            ...(filter.clientId ? { clientId: filter.clientId } : {}),
            ...(filter.route
                ? { route: filter.route }
                : filter.routes
                  ? { route: { in: [...filter.routes] } }
                  : {}),
            ...(filter.outcome
                ? {
                      statusCode:
                          filter.outcome === "success"
                              ? { lt: 400 }
                              : filter.outcome === "rejected"
                                ? { gte: 400, lt: 500 }
                                : { gte: 400 }
                  }
                : {}),
            ...(cursor
                ? {
                      OR: [
                          { createdAt: { gt: cursor.at } },
                          { createdAt: cursor.at, id: { gt: cursor.id } }
                      ]
                  }
                : {})
        }
        const items = await this.analytics.store.db.apiCall.findMany({
            where,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: limit + 1
        })
        await queryCheckpoint(filter.signal)
        const hasMore = items.length > limit
        if (hasMore) items.pop()
        const last = items.at(-1)
        const executions =
            await this.analytics.store.db.translationRequest.findMany({
                where: {
                    id: {
                        in: items.flatMap(item =>
                            item.translationRequestId
                                ? [item.translationRequestId]
                                : []
                        )
                    }
                }
            })
        await queryCheckpoint(filter.signal)
        const byId = new Map(executions.map(item => [item.id, item]))
        const analyses = await this.analytics.store.db.contentAnalysis.findMany(
            {
                where: {
                    requestId: { in: executions.map(item => item.id) },
                    version: ANALYSIS_VERSION
                }
            }
        )
        await queryCheckpoint(filter.signal)
        const analysisById = new Map(
            analyses.map(item => [
                item.requestId,
                {
                    ...item,
                    topics: JSON.parse(item.topics) as unknown,
                    keywords: JSON.parse(item.keywords) as unknown
                }
            ])
        )
        return {
            items: items.map(item => ({
                ...item,
                translation: item.translationRequestId
                    ? (byId.get(item.translationRequestId) ?? null)
                    : null,
                analysis: item.translationRequestId
                    ? (analysisById.get(item.translationRequestId) ?? null)
                    : null
            })),
            nextCursor:
                hasMore && last
                    ? Buffer.from(
                          JSON.stringify([
                              last.createdAt.toISOString(),
                              last.id
                          ])
                      ).toString("base64url")
                    : null
        }
    }
}

export const stringifyAnalytics = (value: unknown) =>
    JSON.stringify(value, (_key, item: unknown) =>
        typeof item === "bigint" ? item.toString() : item
    )
