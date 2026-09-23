import { beforeEach, describe, expect, it, vi } from "vitest"

import { handleTranslateRequest } from "@/background/messages/translate-request"
import type { TranslateRequestSender } from "@/translation/GoogleTranslator"
import {
    createMewCatBatches,
    MewCatTranslator
} from "@/translation/MewCatTranslator"
import { RequestType } from "@/types/request"

const { backgroundTranslate, backgroundAbortAll } = vi.hoisted(() => ({
    backgroundTranslate: vi.fn(),
    backgroundAbortAll: vi.fn()
}))

vi.mock("@/background/lib/mewcat-service", () => ({
    mewCatService: {
        translate: backgroundTranslate,
        abortAll: backgroundAbortAll
    }
}))

describe("MewCatTranslator", () => {
    beforeEach(() => vi.clearAllMocks())

    it("按服务上限安全分片并原样保留分隔符和空白段", async () => {
        const requests: string[][] = []
        const sender: TranslateRequestSender = vi.fn(async request => {
            if (request.type !== RequestType.MEWCAT_TRANSLATE) {
                throw new Error("unexpected request")
            }
            requests.push(request.config.texts)
            return {
                success: true,
                content: { translations: [...request.config.texts] }
            }
        })
        const translator = new MewCatTranslator(sender)
        const longSegment = "a".repeat(4999) + "😀" + "b".repeat(5000)
        const input = `${longSegment}\n\n%%\n\n   \n\n%%\n\ntail`

        await expect(
            translator.translateBatch(
                [{ role: "user", content: input }],
                "zh-CN"
            )
        ).resolves.toBe(input)

        expect(requests.length).toBeGreaterThan(1)
        for (const texts of requests) {
            expect(texts.length).toBeLessThanOrEqual(20)
            expect(
                texts.reduce((sum, text) => sum + text.length, 0)
            ).toBeLessThanOrEqual(5000)
            for (const text of texts) {
                expect(text).not.toMatch(/[\uD800-\uDBFF]$/u)
                expect(text).not.toMatch(/^[\uDC00-\uDFFF]/u)
                expect(text.trim()).not.toBe("")
            }
        }
    })

    it("按项目数与总字符数同时规划批次", () => {
        const batches = createMewCatBatches([
            ...Array.from({ length: 21 }, () => "x"),
            "😀".repeat(2501)
        ])
        expect(batches.flat()).toHaveLength(23)
        expect(batches.every(batch => batch.length <= 20)).toBe(true)
        expect(
            batches.every(
                batch =>
                    batch.reduce((sum, piece) => sum + piece.text.length, 0) <=
                    5000
            )
        ).toBe(true)
    })

    it("响应数量不匹配时失败且不返回部分结果", async () => {
        const sender: TranslateRequestSender = vi.fn(async request => ({
            success: true,
            content: {
                translations:
                    request.type === RequestType.MEWCAT_TRANSLATE
                        ? request.config.texts.slice(0, -1)
                        : []
            }
        }))
        const translator = new MewCatTranslator(sender)

        await expect(
            translator.translateBatch(
                [{ role: "user", content: "first\n\n%%\n\nsecond" }],
                "zh-CN"
            )
        ).rejects.toThrow("mewCat 翻译返回数量不匹配")
        expect(sender).toHaveBeenCalledTimes(1)
    })

    it("拒绝无法识别的响应", async () => {
        const translator = new MewCatTranslator(
            vi.fn(async () => ({
                success: true,
                content: { translations: [1] }
            }))
        )
        await expect(
            translator.translateText(
                [{ role: "user", content: "hello" }],
                "zh-CN"
            )
        ).rejects.toThrow("mewCat 翻译返回了无法识别的响应")
    })
})

describe("mewCat background 路由", () => {
    beforeEach(() => vi.clearAllMocks())

    it("返回批量译文", async () => {
        backgroundTranslate.mockResolvedValue(["你好"])
        await expect(
            handleTranslateRequest({
                type: RequestType.MEWCAT_TRANSLATE,
                config: { texts: ["hello"], targetLanguage: "zh-CN" }
            })
        ).resolves.toEqual({
            success: true,
            content: { translations: ["你好"] }
        })
    })

    it("统一中止请求也取消 mewCat 请求", async () => {
        await expect(
            handleTranslateRequest({ type: RequestType.ABORT, config: null })
        ).resolves.toMatchObject({ success: true })
        expect(backgroundAbortAll).toHaveBeenCalledTimes(1)
    })
})
