import {
    analyticsQuerySchema,
    analyticsResultSchema,
    analyticsRoutes,
    type AnalyticsResult,
    type AnalyticsQuery as QueryInput
} from "@mewcat/protocol"
import { z } from "zod"

import { ApiError } from "../errors.js"
import { AnalyticsQuery, parseRange, stringifyAnalytics } from "./query.js"
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
    value: Awaited<ReturnType<AnalyticsQuery["summary"]>>
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
    async query(clientId: string, input: unknown): Promise<AnalyticsResult> {
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
            const value = await this.execute(parsed.data)
            const json = stringifyAnalytics(value)
            if (Buffer.byteLength(json) > 256 * 1024)
                throw new ApiError(
                    503,
                    "ANALYTICS_BUSY",
                    "查询结果过大，请缩小范围"
                )
            return analyticsResultSchema.parse(JSON.parse(json))
        } finally {
            this.inFlight--
        }
    }
    private async execute(input: QueryInput) {
        const now = Date.now(),
            db = this.analytics.store.db
        const range =
            input.operation === "profile"
                ? parseRange(undefined, undefined, now)
                : parseRange(input.from, input.to, now)
        const summary = await this.queries.summary(
            range,
            now,
            input.operation === "profile" ? input.clientId : undefined,
            input.operation === "overview" ? "/v1/translate" : undefined
        )
        const base = {
            asOf: new Date(now).toISOString(),
            coverage: summary.coverage
        }
        if (input.operation === "overview") {
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
                time < range.to.getTime();
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
                p95DurationMs: summary.p95DurationMs,
                p95UnavailableReason: summary.p95UnavailableReason,
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
                analysis: analysisState(summary)
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
            const profile = await this.queries.profile(input.clientId, now)
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
                analysis: analysisState(summary)
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
