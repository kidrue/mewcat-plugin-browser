import { z } from "zod"

import { analyticsDate, isAnalyticsDateRange } from "./analytics.js"

export const DEVICE_ACTIVITY_PATH = "/v1/activity"
export const DEVICE_ACTIVITY_ANALYTICS_PATH = "/v1/analytics/activity"
export const DEVICE_ACTIVITY_UNINSTALL_PATH = "/v1/activity/uninstall"
export const DEVICE_ACTIVITY_MAX_REVISION = 2_147_483_646

const activityRevision = z
    .number()
    .int()
    .min(0)
    .max(DEVICE_ACTIVITY_MAX_REVISION)
const revision = activityRevision.min(1)

export const deviceActivityInputSchema = z.discriminatedUnion("operation", [
    z.strictObject({
        operation: z.literal("enable"),
        newInstall: z.boolean(),
        revision
    }),
    z.strictObject({ operation: z.literal("disable"), revision }),
    z.strictObject({
        operation: z.literal("page"),
        revision,
        eventId: z.string().uuid(),
        pageKey: z.string().regex(/^[0-9a-f]{64}$/)
    })
])

export const deviceActivityResultSchema = z.strictObject({
    enabled: z.boolean(),
    revision: activityRevision,
    uninstallPath: z
        .string()
        .regex(
            new RegExp(
                `^${DEVICE_ACTIVITY_UNINSTALL_PATH}/[A-Za-z0-9_-]{32,100}$`
            )
        )
        .nullable()
})

export const deviceActivityQuerySchema = z
    .discriminatedUnion("operation", [
        z.strictObject({
            operation: z.literal("overview"),
            from: analyticsDate,
            to: analyticsDate
        }),
        z.strictObject({
            operation: z.literal("profile"),
            clientId: z.string().uuid()
        })
    ])
    .refine(
        input => input.operation === "profile" || isAnalyticsDateRange(input),
        "日期区间须为 1–90 天"
    )

const count = z.number().int().nonnegative()
const time = z.string().datetime().nullable()
const metrics = {
    installs: count,
    uninstalls: count,
    activeDevices: count,
    firstTranslationDevices: count,
    pages: count
}

export const deviceActivityAnalyticsSchema = z.discriminatedUnion("operation", [
    z.strictObject({
        operation: z.literal("overview"),
        ...metrics,
        days: z
            .array(z.strictObject({ day: analyticsDate, ...metrics }))
            .max(90)
    }),
    z.strictObject({
        operation: z.literal("profile"),
        installedAt: time,
        uninstalledAt: time,
        lastTranslationAt: time,
        pagesLast7: count,
        pagesLast30: count
    })
])

export type DeviceActivityInput = z.infer<typeof deviceActivityInputSchema>
export type DeviceActivityResult = z.infer<typeof deviceActivityResultSchema>
export type DeviceActivityQuery = z.infer<typeof deviceActivityQuerySchema>
export type DeviceActivityAnalytics = z.infer<
    typeof deviceActivityAnalyticsSchema
>
