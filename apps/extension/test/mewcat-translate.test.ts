import { chatCompletionInputSchema } from "@mewcat/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { handleTranslateRequest } from "@/background/messages/translate-request"
import { MEWCAT_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import type { MewCatCompletionSender } from "@/messaging/mewcatCompletion"
import {
    getTranslationServiceOptions,
    resolveTranslationServiceId
} from "@/state/translationService"
import {
    createMewCatBatches,
    MewCatTranslator
} from "@/features/translation-services/MewCatTranslator"
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

    it("splits batches when escaped input would exceed the completion size limit", async () => {
        const inputs: string[] = []
        const translator = new MewCatTranslator(
            async ({ input }) => {
                expect(chatCompletionInputSchema.safeParse(input).success).toBe(
                    true
                )
                const { texts } = JSON.parse(input.messages[1].content) as {
                    texts: string[]
                }
                inputs.push(...texts)
                return {
                    success: true,
                    text: JSON.stringify({ translations: texts })
                }
            },
            {
                customPrompt: "注意术语。".repeat(300),
                context: "金融领域".repeat(500)
            }
        )
        const text = "开头" + "\u0000".repeat(4500) + "末尾"
        await expect(
            translator.translateText([{ role: "user", content: text }], "zh-CN")
        ).resolves.toBe(text)
        expect(inputs.length).toBeGreaterThan(1)
    })

    it("limits context without splitting a surrogate pair and repeats it for every batch", async () => {
        const contexts: unknown[] = []
        const translator = new MewCatTranslator(
            async request => {
                const data = JSON.parse(request.input.messages[1].content)
                contexts.push(data.context)
                return {
                    success: true,
                    text: JSON.stringify({ translations: data.texts })
                }
            },
            { context: "x".repeat(1999) + "😀tail" }
        )
        const text = Array.from({ length: 21 }, () => "bank").join("\n\n%%\n\n")
        await expect(
            translator.translateBatch(
                [{ role: "user", content: text }],
                "zh-CN"
            )
        ).resolves.toBe(text)
        expect(contexts).toEqual(["x".repeat(1999), "x".repeat(1999)])
    })

    it("按服务上限安全分片并原样保留分隔符和空白段", async () => {
        const requests: string[][] = []
        const sender: MewCatCompletionSender = vi.fn(async request => {
            const { texts } = JSON.parse(request.input.messages[1].content) as {
                texts: string[]
            }
            requests.push(texts)
            return {
                success: true,
                text: JSON.stringify({ translations: texts })
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
        const sender: MewCatCompletionSender = vi.fn(async request => {
            const { texts } = JSON.parse(request.input.messages[1].content) as {
                texts: string[]
            }
            return {
                success: true,
                text: JSON.stringify({ translations: texts.slice(0, -1) })
            }
        })
        const translator = new MewCatTranslator(sender)

        await expect(
            translator.translateBatch(
                [{ role: "user", content: "first\n\n%%\n\nsecond" }],
                "zh-CN"
            )
        ).rejects.toThrow("mewCat 翻译返回数量不匹配")
        expect(sender).toHaveBeenCalledTimes(1)
    })

    it.each(['{"translations":[1]}', '{"translations":["  "]}'])(
        "拒绝无效译文 %s",
        async text => {
            const translator = new MewCatTranslator(
                vi.fn(async () => ({
                    success: true,
                    text
                }))
            )
            await expect(
                translator.translateText(
                    [{ role: "user", content: "hello" }],
                    "zh-CN"
                )
            ).rejects.toThrow("mewCat 翻译返回了无法识别的响应")
        }
    )
})

describe("mewCat 服务选择", () => {
    it("保留内置服务 ID 并显示免费服务选项", () => {
        expect(
            resolveTranslationServiceId({
                currentModel: MEWCAT_TRANSLATE_MODEL_ID,
                aiModelList: []
            })
        ).toBe(MEWCAT_TRANSLATE_MODEL_ID)
        expect(getTranslationServiceOptions([])).toContainEqual({
            value: MEWCAT_TRANSLATE_MODEL_ID,
            label: "mewCat AI 翻译（免费）"
        })
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
