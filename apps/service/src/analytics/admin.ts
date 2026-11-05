import {
    analyticsQuerySchema,
    analyticsResultSchema,
    analyticsRoutes,
    type AnalyticsResult,
    type AnalyticsQuery as QueryInput
} from "@mewcat/protocol"
import { z } from "zod"

import { ApiError } from "../errors.js"
import { queryCheckpoint } from "./cancellation.js"
import {
    AnalyticsQuery,
    parseRange,
    stringifyAnalytics,
    type Range
} from "./query.js"
import { DAY_MS, utcDay, type AnalyticsStore } from "./store.js"

const projectTotals = (
    value: Awaited<ReturnType<AnalyticsQuery["summary"]>>["totals"]
) => {
    const {
        durationMs: _duration,
        averageTranslationCharacters: _average,
        ...rest
    } = value
    return rest
}
const analysisState = (
    value: Pick<
        Awaited<ReturnType<AnalyticsQuery["summary"]>>,
        "captureContent" | "autoAnalyze" | "analysis"
    >
) => ({
    captureContent: value.captureContent,
    autoAnalyze: value.autoAnalyze,
    completed: value.analysis.completedInRetainedDetails,
    coverage: value.analysis.coverageOfExecutions,
    jobs: Object.entries(value.analysis.jobs).map(([status, count]) => ({
        status,
        count
    }))
})

export class AdminAnalytics {
    readonly queries: AnalyticsQuery
    private inFlight = 0
    constructor(readonly analytics: AnalyticsStore) {
        this.queries = new AnalyticsQuery(analytics)
    }
    private async coverage(
        range: Range,
        now: number,
        clientId?: string,
        route?: string
    ) {
        const first = await this.analytics.store.db.analyticsDaily.findFirst({
            where: {
                dimension: "route",
                ...(clientId ? { clientId } : {}),
                ...(route ? { value: route } : {})
            },
            orderBy: { day: "asc" },
            select: { day: true }
        })
        const observed =
            !!first &&
            first.day <= utcDay(range.from) &&
            range.to.getTime() <= Date.parse(utcDay(now)) + DAY_MS
        return {
            callsComplete:
                observed &&
                range.from.getTime() >=
                    now -
                        this.analytics.config.ANALYTICS_CALL_RETENTION_DAYS *
                            DAY_MS,
            aggregateComplete:
                observed &&
                utcDay(range.from) >=
                    utcDay(
                        now -
                            this.analytics.config
                                .ANALYTICS_AGGREGATE_RETENTION_DAYS *
                                DAY_MS
                    ),
            earliestObservedDay: first?.day ?? null,
            observationScope: "received-by-this-backend" as const,
            tokenTotals:
                "reported-usage-only; missing-usage-is-unknown" as const
        }
    }
    async query(
        clientId: string,
        input: unknown,
        signal?: AbortSignal
    ): Promise<AnalyticsResult> {
        if (signal?.aborted)
            throw new ApiError(499, "ANALYTICS_CANCELLED", "分析查询已取消")
        if (
            !this.analytics.config.ANALYTICS_ADMIN_CLIENT_IDS.includes(clientId)
        )
            throw new ApiError(
                403,
                "ANALYTICS_FORBIDDEN",
                "当前设备尚未获得管理员权限"
            )
        const parsed = analyticsQuerySchema.safeParse(input)
        if (!parsed.success)
            throw new ApiError(400, "INVALID_REQUEST", "分析查询参数不正确")
        if ("cursor" in parsed.data && parsed.data.cursor) {
            try {
                if (!/^[A-Za-z0-9_-]+$/.test(parsed.data.cursor))
                    throw new Error()
                const cursor: unknown = JSON.parse(
                    Buffer.from(parsed.data.cursor, "base64url").toString(
                        "utf8"
                    )
                )
                if (parsed.data.operation === "devices")
                    z.string().uuid().parse(cursor)
                else
                    z.tuple([
                        z.string().datetime(),
                        z.string().min(1).max(100)
                    ]).parse(cursor)
            } catch {
                throw new ApiError(400, "INVALID_REQUEST", "无效分页游标")
            }
        }
        const minute = Math.floor(Date.now() / 60000)
        await this.analytics.store.consumeBuckets([
            {
                key: `analytics:${clientId}:${minute}`,
                amount: 1,
                limit: 60,
                expiresAt: new Date((minute + 1) * 60000),
                errorCode: "RATE_LIMITED"
            }
        ])
        if (this.inFlight >= 2)
            throw new ApiError(
                503,
                "ANALYTICS_BUSY",
                "分析查询繁忙，请稍后重试"
            )
        this.inFlight++
        try {
            await queryCheckpoint(signal)
            const value = await this.execute(parsed.data, signal)
            await queryCheckpoint(signal)
            const json = stringifyAnalytics(value)
            if (Buffer.byteLength(json) > 256 * 1024)
                throw new ApiError(
                    503,
                    "ANALYTICS_BUSY",
                    "查询结果过大，请缩小范围"
                )
            return analyticsResultSchema.parse(JSON.parse(json))
        } catch (error) {
            if (signal?.aborted)
                throw new ApiError(499, "ANALYTICS_CANCELLED", "分析查询已取消")
            throw error
        } finally {
            this.inFlight--
        }
    }
    private async execute(input: QueryInput, signal?: AbortSignal) {
        await queryCheckpoint(signal)
        const now = Date.now(),
            db = this.analytics.store.db
        const range =
            input.operation === "profile"
                ? parseRange(undefined, undefined, now)
                : parseRange(input.from, input.to, now)
        const coverage = await this.coverage(
            range,
            now,
            input.operation === "profile" || input.operation === "calls"
                ? input.clientId
                : undefined,
            input.operation === "overview"
                ? "/v1/translate"
                : input.operation === "calls"
                  ? input.route
                  : undefined
        )
        const base = {
            asOf: new Date(now).toISOString(),
            coverage
        }
        await queryCheckpoint(signal)
        if (input.operation === "overview") {
            const summary = await this.queries.summary(
                range,
                now,
                undefined,
                "/v1/translate",
                signal
            )
            await queryCheckpoint(signal)
            const byDay = await db.analyticsDaily.groupBy({
                by: ["day"],
                where: {
                    dimension: "route",
                    value: "/v1/translate",
                    day: { gte: input.from, lt: input.to }
                },
                _sum: { requests: true, characters: true },
                orderBy: { day: "asc" }
            })
            const days = []
            const firstCovered = Math.max(
                range.from.getTime(),
                Date.parse(summary.coverage.earliestObservedDay ?? input.to),
                Date.parse(
                    utcDay(
                        now -
                            this.analytics.config
                                .ANALYTICS_AGGREGATE_RETENTION_DAYS *
                                DAY_MS
                    )
                )
            )
            for (
                let time = firstCovered;
                time <
                Math.min(range.to.getTime(), Date.parse(utcDay(now)) + DAY_MS);
                time += DAY_MS
            ) {
                const day = utcDay(time),
                    row = byDay.find(item => item.day === day)
                days.push({
                    day,
                    requests: row?._sum.requests ?? 0n,
                    characters: row?._sum.characters ?? 0n
                })
            }
            await queryCheckpoint(signal)
            const languages = await db.analyticsDaily.groupBy({
                by: ["value"],
                where: {
                    dimension: "language",
                    day: { gte: input.from, lt: input.to }
                },
                _sum: { requests: true, characters: true },
                orderBy: { _sum: { requests: "desc" } },
                take: 20
            })
            await queryCheckpoint(signal)
            const errors = await db.apiCall.groupBy({
                by: ["errorCode"],
                where: {
                    route: "/v1/translate",
                    createdAt: { gte: range.from, lt: range.to },
                    errorCode: { not: null }
                },
                _count: true,
                orderBy: { _count: { errorCode: "desc" } },
                take: 20
            })
            return {
                operation: input.operation,
                ...base,
                from: input.from,
                to: input.to,
                totals: projectTotals(summary.totals),
                activeDevices: summary.activeDevices,
                p95DurationMs: coverage.callsComplete
                    ? summary.p95DurationMs
                    : null,
                p95UnavailableReason: coverage.callsComplete
                    ? summary.p95UnavailableReason
                    : "incomplete-observation",
                days,
                languages: languages.map(row => ({
                    languagePair: JSON.parse(row.value),
                    requests: row._sum.requests ?? 0n,
                    characters: row._sum.characters ?? 0n
                })),
                errors: errors.map(row => ({
                    code: row.errorCode!,
                    requests: String(row._count)
                })),
                analysis: {
                    ...analysisState(summary),
                    coverage: coverage.aggregateComplete
                        ? summary.analysis.coverageOfExecutions
                        : null
                }
            }
        }
        if (input.operation === "profile") {
            if (
                !(await db.client.findUnique({
                    where: { id: input.clientId },
                    select: { id: true }
                }))
            )
                throw new ApiError(
                    404,
                    "ANALYTICS_DEVICE_NOT_FOUND",
                    "设备不存在"
                )
            await queryCheckpoint(signal)
            const profile = await this.queries.profile(
                input.clientId,
                now,
                signal
            )
            return {
                operation: input.operation,
                ...base,
                client: profile.client,
                last7Days: projectTotals(profile.last7Days),
                last30Days: projectTotals(profile.last30Days),
                activeDaysLast7: profile.activeDaysLast7,
                activeDaysLast30: profile.activeDaysLast30,
                lastObservedCall: profile.lastObservedCallInRetention,
                languages: profile.languages
                    .sort((a, b) => (a.requests > b.requests ? -1 : 1))
                    .slice(0, 20),
                errors: profile.errors
                    .sort((a, b) => (a.requests > b.requests ? -1 : 1))
                    .slice(0, 20),
                activeHoursUtc: profile.activeHoursUtc,
                topics: profile.recentContentInterests
                    .slice(0, 20)
                    .map(({ topic, samples, share }) => ({
                        topic,
                        samples,
                        share
                    })),
                keywords: profile.recentKeywords,
                analysis: {
                    ...analysisState(profile),
                    coverage: coverage.aggregateComplete
                        ? profile.analysis.coverageOfExecutions
                        : null
                }
            }
        }
        if (input.operation === "devices") {
            let after: string | undefined
            if (input.cursor) {
                try {
                    after = z
                        .string()
                        .uuid()
                        .parse(
                            JSON.parse(
                                Buffer.from(
                                    input.cursor,
                                    "base64url"
                                ).toString()
                            )
                        )
                } catch {
                    throw new ApiError(400, "INVALID_REQUEST", "无效分页游标")
                }
            }
            const rows = await db.analyticsDaily.groupBy({
                by: ["clientId"],
                where: {
                    dimension: "route",
                    value: { in: [...analyticsRoutes] },
                    day: { gte: input.from, lt: input.to },
                    clientId: input.clientId ?? {
                        not: "",
                        ...(after ? { gt: after } : {})
                    },
                    ...(input.clientId && after
                        ? { AND: { clientId: { gt: after } } }
                        : {})
                },
                _sum: { requests: true, characters: true },
                _max: { day: true },
                orderBy: { clientId: "asc" },
                take: input.limit + 1
            })
            await queryCheckpoint(signal)
            const more = rows.length > input.limit
            if (more) rows.pop()
            const clients = await db.client.findMany({
                where: { id: { in: rows.map(row => row.clientId) } },
                select: {
                    id: true,
                    name: true,
                    createdAt: true,
                    revokedAt: true
                }
            })
            return {
                operation: input.operation,
                ...base,
                items: rows.flatMap(row => {
                    const client = clients.find(
                        item => item.id === row.clientId
                    )
                    return client
                        ? [
                              {
                                  client,
                                  requests: row._sum.requests ?? 0n,
                                  characters: row._sum.characters ?? 0n,
                                  lastObservedDay: row._max.day!
                              }
                          ]
                        : []
                }),
                nextCursor:
                    more && rows.length
                        ? Buffer.from(
                              JSON.stringify(rows.at(-1)!.clientId)
                          ).toString("base64url")
                        : null
            }
        }
        let calls
        try {
            calls = await this.queries.calls({
                ...range,
                ...(signal ? { signal } : {}),
                limit: input.limit,
                routes: analyticsRoutes,
                ...(input.clientId ? { clientId: input.clientId } : {}),
                ...(input.route ? { route: input.route } : {}),
                ...(input.cursor ? { cursor: input.cursor } : {}),
                ...(input.outcome ? { outcome: input.outcome } : {})
            })
        } catch (error) {
            if (error instanceof Error && error.message === "无效分页游标")
                throw new ApiError(400, "INVALID_REQUEST", error.message)
            throw error
        }
        return {
            operation: input.operation,
            ...base,
            items: calls.items
                .filter(item =>
                    (analyticsRoutes as readonly string[]).includes(item.route)
                )
                .map(item => ({
                    id: item.id,
                    createdAt: item.createdAt,
                    clientId: item.clientId,
                    route: item.route,
                    statusCode: item.statusCode,
                    errorCode: item.errorCode,
                    durationMs: item.durationMs,
                    translation: item.translation
                        ? {
                              characters: item.translation.inputCharacters,
                              promptTokens: item.translation.promptTokens,
                              completionTokens:
                                  item.translation.completionTokens,
                              sourceLanguage: item.translation.sourceLanguage,
                              targetLanguage: item.translation.targetLanguage,
                              model: item.translation.model
                          }
                        : null,
                    analysis: item.analysis
                        ? {
                              topics: item.analysis.topics,
                              keywords: item.analysis.keywords
                          }
                        : null
                })),
            nextCursor: calls.nextCursor
        }
    }
}
