import { describe, expect, it, vi } from "vitest"

import { defaultExtensionConfig } from "../src/state/constants"
import { createTranslationServiceStorageAdapter } from "../src/state/translationService"
import { AiModel_Platform_Enum } from "../src/types/aiModel"
import type { ExtensionConfig } from "../src/types/config"
import { repairExtensionConfig } from "../src/types/extensionConfigSchema"

const validModel = {
    id: "model-1",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    name: "OpenAI",
    params: {
        modelName: "gpt-4o-mini",
        isOfficial: true,
        apiKey: "secret-key"
    }
}

describe("extension config validation", () => {
    it("repairs invalid fields without discarding valid user settings", () => {
        const repaired = repairExtensionConfig(
            {
                ...defaultExtensionConfig,
                targetLanguage: 42,
                selectionTriggerMode: "broken",
                autoTranslateDelay: -1,
                aiModelList: [validModel, { id: "broken-model" }],
                unknownField: "remove-me"
            },
            defaultExtensionConfig
        )

        expect(repaired.targetLanguage).toBe(
            defaultExtensionConfig.targetLanguage
        )
        expect(repaired.selectionTriggerMode).toBe(
            defaultExtensionConfig.selectionTriggerMode
        )
        expect(repaired.autoTranslateDelay).toBe(
            defaultExtensionConfig.autoTranslateDelay
        )
        expect(repaired.aiModelList).toEqual([validModel])
        expect(repaired.aiModelList[0]?.params.apiKey).toBe("secret-key")
        expect(repaired).not.toHaveProperty("unknownField")
    })

    it("falls back safely when the stored value is not an object", () => {
        expect(
            repairExtensionConfig("corrupted", defaultExtensionConfig)
        ).toEqual(defaultExtensionConfig)
    })

    it("writes a repaired stored config back before returning it", async () => {
        const setItem = vi.fn(async () => undefined)
        const adapter = createTranslationServiceStorageAdapter({
            getItem: vi.fn(async () => ({
                ...defaultExtensionConfig,
                targetLanguage: null
            })),
            setItem,
            removeItem: vi.fn(async () => undefined),
            subscribe: vi.fn(() => () => undefined)
        })

        const result = await adapter.getItem(
            "extension-config",
            defaultExtensionConfig
        )

        expect(result.targetLanguage).toBe(
            defaultExtensionConfig.targetLanguage
        )
        expect(setItem).toHaveBeenCalledWith("extension-config", result)
    })

    it("preserves legacy model fields until the existing migration runs", async () => {
        const adapter = createTranslationServiceStorageAdapter({
            getItem: vi.fn(async () => ({
                ...defaultExtensionConfig,
                aiModelList: [
                    {
                        ...validModel,
                        type: AiModel_Platform_Enum.HUOSHAN,
                        params: {
                            ...validModel.params,
                            modelName: "",
                            endpoint: "ep-legacy"
                        }
                    }
                ]
            })),
            setItem: vi.fn(async () => undefined),
            removeItem: vi.fn(async () => undefined),
            subscribe: vi.fn(() => () => undefined)
        })

        const result = await adapter.getItem(
            "extension-config",
            defaultExtensionConfig
        )

        expect(result.aiModelList[0]?.params.modelName).toBe("ep-legacy")
        expect(result.aiModelList[0]?.params).not.toHaveProperty("endpoint")
    })

    it("repairs malformed values before writing them to storage", async () => {
        const setItem = vi.fn(async () => undefined)
        const adapter = createTranslationServiceStorageAdapter({
            getItem: vi.fn(async (_key, initialValue) => initialValue),
            setItem,
            removeItem: vi.fn(async () => undefined),
            subscribe: vi.fn(() => () => undefined)
        })

        await adapter.setItem("extension-config", {
            targetLanguage: 42
        } as unknown as ExtensionConfig)

        expect(setItem).toHaveBeenCalledWith(
            "extension-config",
            defaultExtensionConfig
        )
    })
})
