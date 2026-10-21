import { describe, expect, it } from "vitest"

import {
    estimateTokenCount,
    normalizeReportedUsage
} from "../src/token-usage/estimate"
import {
    clearTokenUsage,
    readTokenUsage,
    recordTokenUsage,
    type TokenUsageStorageArea
} from "../src/token-usage/storage"

class MemoryStorage implements TokenUsageStorageArea {
    data: Record<string, unknown> = {}

    async get(key: string) {
        return { [key]: this.data[key] }
    }

    async set(items: Record<string, unknown>) {
        Object.assign(this.data, items)
    }

    async remove(key: string) {
        delete this.data[key]
    }
}

describe("token usage", () => {
    it("estimates mixed CJK and Latin text consistently", () => {
        expect(estimateTokenCount("你好 test")).toBe(3)
        expect(estimateTokenCount("abcdefgh")).toBe(2)
        expect(estimateTokenCount("   ")).toBe(0)
    })

    it("normalizes OpenAI and xsAI usage shapes", () => {
        expect(
            normalizeReportedUsage({
                prompt_tokens: 12,
                completion_tokens: 5,
                total_tokens: 17
            })
        ).toEqual({ inputTokens: 12, outputTokens: 5, totalTokens: 17 })
        expect(
            normalizeReportedUsage({ inputTokens: 4, outputTokens: 6 })
        ).toEqual({ inputTokens: 4, outputTokens: 6, totalTokens: 10 })
        expect(normalizeReportedUsage({ inputTokens: -1 })).toBeUndefined()
    })

    it("repairs malformed records, aggregates matching dimensions, and prunes old days", async () => {
        const storage = new MemoryStorage()
        storage.data["token-usage"] = {
            version: 1,
            entries: [
                {
                    date: "2026-08-01",
                    modelId: "old",
                    modelName: "Old",
                    feature: "page-translation",
                    source: "reported",
                    inputTokens: 100,
                    outputTokens: 10,
                    totalTokens: 110,
                    requestCount: 1
                },
                {
                    date: "2026-09-07",
                    modelId: "model-a",
                    modelName: "Model A",
                    feature: "page-translation",
                    source: "reported",
                    inputTokens: "broken",
                    outputTokens: 2,
                    totalTokens: 2,
                    requestCount: 1
                },
                null
            ]
        }

        await recordTokenUsage(
            {
                date: "2026-09-07",
                modelId: "model-a",
                modelName: "Model A",
                feature: "page-translation",
                source: "reported",
                counts: { inputTokens: 5, outputTokens: 3, totalTokens: 8 }
            },
            { storage, key: "token-usage", now: () => new Date("2026-09-07") }
        )

        const result = await readTokenUsage({
            storage,
            key: "token-usage",
            now: () => new Date("2026-09-07")
        })
        expect(result.entries).toEqual([
            {
                date: "2026-09-07",
                modelId: "model-a",
                modelName: "Model A",
                feature: "page-translation",
                source: "reported",
                inputTokens: 5,
                outputTokens: 5,
                totalTokens: 10,
                requestCount: 2
            }
        ])
    })

    it("clears persisted statistics", async () => {
        const storage = new MemoryStorage()
        storage.data.usage = { version: 1, entries: [] }
        await clearTokenUsage({ storage, key: "usage" })
        expect(storage.data.usage).toBeUndefined()
    })
})
