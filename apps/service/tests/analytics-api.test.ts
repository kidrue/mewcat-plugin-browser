import { analyticsQuerySchema, analyticsResultSchema } from "@mewcat/protocol"
import { describe, expect, it } from "vitest"

describe("管理员分析协议", () => {
    it("限制真实 UTC 日期、90 天、分页及未使用的参数", () => {
        const input = {
            operation: "calls",
            from: "2026-10-30",
            to: "2026-11-06"
        }
        expect(analyticsQuerySchema.parse(input)).toMatchObject({ limit: 20 })
        for (const change of [
            { from: "2026-02-30" },
            { from: "2025-01-01" },
            { limit: 101 },
            { cursor: "x".repeat(501) },
            { unused: true }
        ])
            expect(
                analyticsQuerySchema.safeParse({ ...input, ...change }).success
            ).toBe(false)
        expect(
            analyticsQuerySchema.safeParse({
                operation: "profile",
                clientId: crypto.randomUUID(),
                from: "2026-11-01"
            }).success
        ).toBe(false)
    })
    it("严格拒绝未知结果和夹带正文的响应", () => {
        expect(
            analyticsResultSchema.safeParse({ operation: "unknown" }).success
        ).toBe(false)
        expect(
            analyticsResultSchema.safeParse({
                operation: "calls",
                asOf: new Date().toISOString(),
                items: [],
                nextCursor: null,
                original: "secret"
            }).success
        ).toBe(false)
    })
})
