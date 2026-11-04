import { z } from "zod"

const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(value => {
        const time = Date.parse(value)
        return (
            Number.isFinite(time) &&
            new Date(time).toISOString().slice(0, 10) === value
        )
    }, "无效 UTC 日期")
const range = { from: date, to: date }
const id = z.string().uuid()
const page = {
    cursor: z.string().min(1).max(500).optional(),
    limit: z.number().int().min(1).max(100).default(20)
}
export const analyticsRoutes = [
    "/v1/clients/register",
    "/v1/usage",
    "/v1/feedback",
    "/v1/translate"
] as const
export const analyticsQuerySchema = z
    .discriminatedUnion("operation", [
        z.strictObject({ operation: z.literal("overview"), ...range }),
        z.strictObject({
            operation: z.literal("devices"),
            ...range,
            clientId: id.optional(),
            ...page
        }),
        z.strictObject({ operation: z.literal("profile"), clientId: id }),
        z.strictObject({
            operation: z.literal("calls"),
            ...range,
            clientId: id.optional(),
            route: z.enum(analyticsRoutes).optional(),
            outcome: z.enum(["success", "failed", "rejected"]).optional(),
            ...page
        })
    ])
    .refine(
        input =>
            !("from" in input) ||
            (Date.parse(input.to) > Date.parse(input.from) &&
                Date.parse(input.to) - Date.parse(input.from) <= 90 * 86400000),
        "日期区间须为 1–90 天"
    )
export type AnalyticsInput = z.input<typeof analyticsQuerySchema>
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>

const count = z.string().regex(/^\d+$/).max(100)
const finite = z.number().finite().nonnegative()
const nullableTime = z.string().datetime().nullable()
const totals = z.strictObject({
    requests: count,
    successes: count,
    failures: count,
    rejected: count,
    executions: count,
    characters: count,
    promptTokens: count,
    completionTokens: count,
    successRate: z.number().min(0).max(1).nullable(),
    averageDurationMs: finite.nullable()
})
const coverage = z.strictObject({
    callsComplete: z.boolean(),
    aggregateComplete: z.boolean(),
    earliestObservedDay: date.nullable(),
    observationScope: z.literal("received-by-this-backend"),
    tokenTotals: z.literal("reported-usage-only; missing-usage-is-unknown")
})
const analysis = z.strictObject({
    captureContent: z.boolean(),
    autoAnalyze: z.boolean(),
    completed: z.number().int().nonnegative(),
    coverage: z.number().min(0).max(1).nullable(),
    jobs: z
        .array(
            z.strictObject({
                status: z.string().max(30),
                count: z.number().int().nonnegative()
            })
        )
        .max(20)
})
const languages = z
    .array(
        z.strictObject({
            languagePair: z.tuple([z.string().max(35), z.string().max(35)]),
            requests: count,
            characters: count
        })
    )
    .max(20)
const errors = z
    .array(z.strictObject({ code: z.string().max(100), requests: count }))
    .max(20)
const base = { asOf: z.string().datetime(), coverage }
const client = z.strictObject({
    id,
    name: z.string().max(80),
    createdAt: z.string().datetime(),
    revokedAt: nullableTime
})
export const analyticsResultSchema = z.discriminatedUnion("operation", [
    z.strictObject({
        operation: z.literal("overview"),
        ...base,
        from: date,
        to: date,
        totals,
        activeDevices: z.number().int().nonnegative(),
        p95DurationMs: finite.nullable(),
        p95UnavailableReason: z.string().max(100).nullable(),
        days: z
            .array(
                z.strictObject({
                    day: date,
                    requests: count,
                    characters: count
                })
            )
            .max(90),
        languages,
        errors,
        analysis
    }),
    z.strictObject({
        operation: z.literal("devices"),
        ...base,
        items: z
            .array(
                z.strictObject({
                    client,
                    requests: count,
                    characters: count,
                    lastObservedDay: date
                })
            )
            .max(100),
        nextCursor: z.string().max(500).nullable()
    }),
    z.strictObject({
        operation: z.literal("profile"),
        ...base,
        client,
        last7Days: totals,
        last30Days: totals,
        activeDaysLast7: z.number().int().nonnegative(),
        activeDaysLast30: z.number().int().nonnegative(),
        lastObservedCall: nullableTime,
        languages,
        errors,
        activeHoursUtc: z
            .array(
                z.strictObject({
                    hour: z.number().int().min(0).max(23),
                    requests: count
                })
            )
            .max(24),
        topics: z
            .array(
                z.strictObject({
                    topic: z.string().max(100),
                    samples: count,
                    share: z.number().min(0).max(1).nullable()
                })
            )
            .max(20),
        keywords: z
            .array(
                z.strictObject({
                    keyword: z.string().max(100),
                    samples: z.number().int().nonnegative()
                })
            )
            .max(20),
        analysis
    }),
    z.strictObject({
        operation: z.literal("calls"),
        ...base,
        items: z
            .array(
                z.strictObject({
                    id: z.string().max(100),
                    createdAt: z.string().datetime(),
                    clientId: id.nullable(),
                    route: z.enum(analyticsRoutes),
                    statusCode: z.number().int().min(100).max(599),
                    errorCode: z.string().max(100).nullable(),
                    durationMs: finite,
                    translation: z
                        .strictObject({
                            characters: z.number().int().nonnegative(),
                            promptTokens: z
                                .number()
                                .int()
                                .nonnegative()
                                .nullable(),
                            completionTokens: z
                                .number()
                                .int()
                                .nonnegative()
                                .nullable(),
                            sourceLanguage: z.string().max(35).nullable(),
                            targetLanguage: z.string().max(35).nullable(),
                            model: z.string().max(200).nullable()
                        })
                        .nullable(),
                    analysis: z
                        .strictObject({
                            topics: z
                                .array(
                                    z.strictObject({
                                        topic: z.string().max(100),
                                        confidence: z.number().min(0).max(1)
                                    })
                                )
                                .max(20),
                            keywords: z.array(z.string().max(100)).max(20)
                        })
                        .nullable()
                })
            )
            .max(100),
        nextCursor: z.string().max(500).nullable()
    })
])
export type AnalyticsResult = z.infer<typeof analyticsResultSchema>
export type AnalyticsOverview = Extract<
    AnalyticsResult,
    { operation: "overview" }
>
export type AnalyticsDevices = Extract<
    AnalyticsResult,
    { operation: "devices" }
>
export type AnalyticsProfile = Extract<
    AnalyticsResult,
    { operation: "profile" }
>
export type AnalyticsCalls = Extract<AnalyticsResult, { operation: "calls" }>
