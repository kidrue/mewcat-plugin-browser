import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { handleTextTranslationUsage } from "../src/background/messages/text-translation-usage"
import { STORAGE_NAMES } from "../src/constants/storage"
import {
    GOOGLE_TRANSLATE_MODEL_ID,
    MEWCAT_TRANSLATE_MODEL_ID,
    MICROSOFT_TRANSLATE_MODEL_ID
} from "../src/constants/translationServices"
import {
    clearTextTranslationUsage,
    readTextTranslationUsage,
    summarizeTextTranslationUsage,
    type TextTranslationUsageEntry
} from "../src/features/token-usage/textTranslationUsage"
import {
    buildAiSummary,
    explainConcept,
    testConfiguredModel,
    translateBatch,
    translateText,
    type TranslationRuntimeConfig
} from "../src/features/translation/translationService"
import { AiModel_Platform_Enum, AiRole, type BaseModel } from "../src/types"

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }))
vi.mock("../src/messaging", () => ({ sendMessage }))

const officialModel: BaseModel = {
    id: "openai-primary",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    name: "Primary",
    params: { apiKey: "test-key", modelName: "model" }
}

const config = (model: string | BaseModel): TranslationRuntimeConfig => ({
    aiModelList: typeof model === "string" ? [] : [model],
    currentModel: typeof model === "string" ? model : model.id,
    aiRole: AiRole.DEFAULT
})
const input = (content: string) => [{ role: "user", content }]
const successfulModel = async () => ({ success: true as const, text: "译文" })
const extensionId = "test-extension-id"
const extensionUrl = (path: string) =>
    `chrome-extension://${extensionId}/${path}`
const optionsSender = {
    id: extensionId,
    url: extensionUrl("options.html?tab=usage")
}
const contentSender = { id: extensionId, url: "https://example.test/" }

const entry = (
    date: string,
    characters: number,
    serviceId = "primary",
    serviceName = "主要服务"
): TextTranslationUsageEntry => ({ date, serviceId, serviceName, characters })

function useLocalStorage() {
    const stored = new Map<string, unknown>()
    const storage = {
        get: vi.fn(async (key: string) => ({
            [key]: structuredClone(stored.get(key))
        })),
        set: vi.fn(async (items: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(items)) {
                stored.set(key, structuredClone(value))
            }
        }),
        remove: vi.fn(async (key: string) => {
            stored.delete(key)
        })
    }
    vi.stubGlobal("chrome", {
        runtime: { id: extensionId, getURL: extensionUrl },
        storage: { local: storage }
    })
    return storage
}

describe("text translation usage summaries", () => {
    it("starts the week on Monday and allows it to span a month boundary", () => {
        const summary = summarizeTextTranslationUsage(
            [
                entry("2026-11-03", 100),
                entry("2026-10-25", 90),
                entry("2026-11-01", 8, "secondary", "其他服务"),
                entry("2026-10-26", 4),
                entry("2026-10-31", 2)
            ],
            new Date(2026, 10, 1, 0, 15)
        )
        expect(summary.totals).toEqual({ today: 8, week: 14, month: 8 })
        expect(summary.services).toEqual(
            expect.arrayContaining([
                {
                    serviceId: "primary",
                    serviceName: "主要服务",
                    today: 0,
                    week: 6,
                    month: 0
                },
                {
                    serviceId: "secondary",
                    serviceName: "其他服务",
                    today: 8,
                    week: 8,
                    month: 8
                }
            ])
        )
        expect(summary.services).toHaveLength(2)
    })

    it("keeps monthly counts on Monday and uses the latest service name", () => {
        const summary = summarizeTextTranslationUsage(
            [
                entry("2026-11-02", 7, "primary", "新名称"),
                entry("2026-11-01", 3, "primary", "旧名称"),
                entry("2026-10-31", 100, "retired", "旧服务")
            ],
            new Date(2026, 10, 2, 23, 45)
        )
        expect(summary).toEqual({
            totals: { today: 7, week: 7, month: 10 },
            services: [
                {
                    serviceId: "primary",
                    serviceName: "新名称",
                    today: 7,
                    week: 7,
                    month: 10
                }
            ]
        })
    })
})

describe("local text translation usage", () => {
    let storage: ReturnType<typeof useLocalStorage>

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] })
        vi.setSystemTime(new Date(2026, 10, 2, 23, 45))
        storage = useLocalStorage()
        sendMessage.mockReset().mockImplementation((type, request) => {
            if (type === "text-translation-usage") {
                return handleTextTranslationUsage(
                    request,
                    request.type === "record" ? contentSender : optionsSender
                )
            }
            throw new Error(`Unexpected background message: ${type}`)
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it("groups official providers and keeps distinct custom configuration IDs", async () => {
        const original = input(" A😀 ")
        const renamedModel = {
            ...officialModel,
            id: "openai-alt",
            name: "备用"
        }
        const customModel = (id: string, name: string): BaseModel => ({
            ...officialModel,
            id,
            name,
            params: {
                ...officialModel.params,
                isOfficial: false,
                baseUrl: "https://example.test/v1/"
            }
        })
        for (const model of [
            officialModel,
            renamedModel,
            customModel("first", "相同名称"),
            customModel("second", "相同名称"),
            customModel("first", "修改名称")
        ]) {
            await translateText(
                config(model),
                original,
                "zh-CN",
                {},
                {
                    modelGatewaySender: successfulModel
                }
            )
        }
        const entries = await readTextTranslationUsage()
        expect(entries).toHaveLength(3)
        expect(entries).toEqual(
            expect.arrayContaining([
                entry("2026-11-02", 10, "provider:openai", "ChatGPT"),
                entry("2026-11-02", 10, "custom:first", "修改名称"),
                entry("2026-11-02", 5, "custom:second", "相同名称")
            ])
        )
    })

    it("counts only source segments with translated results, including UTF-16 pairs", async () => {
        const separator = "\n\n%%\n\n"
        const sources = input(["A😀", "untranslated", "B"].join(separator))
        const translated = ["甲", " ", "乙"].join(separator)
        await expect(
            translateBatch(
                config(officialModel),
                sources,
                "zh-CN",
                {
                    context: "附近上下文",
                    pageTitle: "页面标题"
                },
                {
                    modelGatewaySender: async () => ({
                        success: true,
                        text: translated
                    })
                }
            )
        ).resolves.toBe(translated)
        expect(await readTextTranslationUsage()).toEqual([
            entry("2026-11-02", 4, "provider:openai", "ChatGPT")
        ])
    })

    it("skips failed, blank, and unaligned results", async () => {
        const translate = (modelGatewaySender = successfulModel) =>
            translateBatch(
                config(officialModel),
                input("first\n\n%%\n\nsecond"),
                "zh-CN",
                {},
                { modelGatewaySender }
            )
        await expect(
            translate(async () => {
                throw new Error("provider unavailable")
            })
        ).rejects.toThrow("provider unavailable")
        await expect(
            translate(async () => ({ success: true, text: "   " }))
        ).resolves.toBe("   ")
        await expect(translate()).resolves.toBe("译文")
        expect(await readTextTranslationUsage()).toEqual([])
    })

    it("uses the supplied original counts for page segments with generated markup", async () => {
        await translateBatch(
            config(officialModel),
            input("<a1>A😀</a1>@2#\n\n%%\n\n@3#"),
            "zh-CN",
            { sourceCharacterCounts: [3, 0] },
            {
                modelGatewaySender: async () => ({
                    success: true,
                    text: "<a1>甲</a1>@2#\n\n%%\n\n@3#"
                })
            }
        )
        expect(await readTextTranslationUsage()).toEqual([
            entry("2026-11-02", 3, "provider:openai", "ChatGPT")
        ])
    })

    it("records usage for the built-in services under their canonical names", async () => {
        const text = input("hi")
        const requestSender = async () => ({
            success: true as const,
            content: "你好"
        })
        await translateText(
            config(GOOGLE_TRANSLATE_MODEL_ID),
            text,
            "zh-CN",
            {},
            { googleRequestSender: requestSender }
        )
        await translateText(
            config(MICROSOFT_TRANSLATE_MODEL_ID),
            text,
            "zh-CN",
            {},
            { microsoftRequestSender: requestSender }
        )
        await translateText(
            config(MEWCAT_TRANSLATE_MODEL_ID),
            text,
            "zh-CN",
            {},
            {
                mewcatCompletionSender: async () => ({
                    success: true,
                    text: '{"translations":["你好"]}'
                })
            }
        )
        expect(await readTextTranslationUsage()).toEqual([
            entry(
                "2026-11-02",
                2,
                GOOGLE_TRANSLATE_MODEL_ID,
                "Google Translate"
            ),
            entry("2026-11-02", 2, MICROSOFT_TRANSLATE_MODEL_ID, "微软翻译"),
            entry("2026-11-02", 2, MEWCAT_TRANSLATE_MODEL_ID, "mewCat AI 翻译")
        ])
    })

    it("leaves summaries, concept explanations, and model tests out of the ledger", async () => {
        const settings = config(officialModel)
        const sender = { modelGatewaySender: successfulModel }
        await buildAiSummary(settings, "标题", "正文", sender)
        await explainConcept(settings, { text: "术语" }, "zh-CN", sender)
        await testConfiguredModel(
            officialModel,
            "zh-CN",
            AiRole.DEFAULT,
            sender
        )
        expect(await readTextTranslationUsage()).toEqual([])
    })

    it("serializes racing records, clear, and read without reviving old counts", async () => {
        const record = () =>
            handleTextTranslationUsage(
                {
                    type: "record",
                    serviceId: "shared",
                    serviceName: "同一服务",
                    characters: 2
                },
                contentSender
            )
        const first = Array.from({ length: 6 }, record)
        const beforeClear = readTextTranslationUsage()
        const clear = clearTextTranslationUsage()
        const next = Array.from({ length: 3 }, record)
        const afterClear = readTextTranslationUsage()
        expect(await beforeClear).toEqual([
            entry("2026-11-02", 12, "shared", "同一服务")
        ])
        await Promise.all([...first, clear, ...next])
        expect(await afterClear).toEqual([
            entry("2026-11-02", 6, "shared", "同一服务")
        ])
    })

    it("prunes usage older than 62 local calendar days when recording", async () => {
        await storage.set({
            [STORAGE_NAMES.textTranslationUsage]: [
                entry("2026-09-02", 10),
                entry("2026-09-01", 99)
            ]
        })
        await handleTextTranslationUsage(
            {
                type: "record",
                serviceId: "primary",
                serviceName: "主要服务",
                characters: 5
            },
            contentSender
        )
        const current = [entry("2026-09-02", 10), entry("2026-11-02", 5)]
        expect(await readTextTranslationUsage()).toEqual(current)
        expect(await storage.get(STORAGE_NAMES.textTranslationUsage)).toEqual({
            [STORAGE_NAMES.textTranslationUsage]: current
        })
    })

    it("removes expired and invalid entries when reading before the next translation", async () => {
        const key = STORAGE_NAMES.textTranslationUsage
        await storage.set({
            [key]: [
                entry("2026-09-01", 99),
                entry("2026-11-01", 0),
                entry("2026-11-31", 5)
            ]
        })
        expect(await readTextTranslationUsage()).toEqual([])
        expect((await storage.get(key))[key]).toBeUndefined()
    })

    it("limits reading and clearing to options and rejects records from other senders", async () => {
        const event = {
            type: "record" as const,
            serviceId: "shared",
            serviceName: "同一服务",
            characters: 3
        }
        await handleTextTranslationUsage(event, contentSender)
        await expect(
            handleTextTranslationUsage(event, { id: "external" })
        ).rejects.toThrow()
        await expect(
            handleTextTranslationUsage({ type: "read" }, contentSender)
        ).rejects.toThrow()
        await expect(
            handleTextTranslationUsage({ type: "clear" }, contentSender)
        ).rejects.toThrow()
        expect(await readTextTranslationUsage()).toEqual([
            entry("2026-11-02", 3, "shared", "同一服务")
        ])
    })

    it("returns translations while writes are pending and survives storage failures", async () => {
        let failWrite!: (reason: Error) => void
        const blockedWrite = new Promise<void>((_, reject) => {
            failWrite = reject
        })
        void blockedWrite.catch(() => {})
        storage.set.mockReturnValueOnce(blockedWrite)
        const translate = () =>
            translateText(
                config(officialModel),
                input("cat"),
                "zh-CN",
                {},
                {
                    modelGatewaySender: successfulModel
                }
            )
        try {
            await expect(translate()).resolves.toBe("译文")
        } finally {
            failWrite(new Error("storage unavailable"))
        }
        await expect(translate()).resolves.toBe("译文")
        expect(await readTextTranslationUsage()).toEqual([
            entry("2026-11-02", 3, "provider:openai", "ChatGPT")
        ])
    })
})
