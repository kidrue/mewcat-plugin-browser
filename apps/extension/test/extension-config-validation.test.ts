import { describe, expect, it, vi } from "vitest"

import { defaultExtensionConfig } from "../src/state/constants"
import { createTranslationServiceStorageAdapter } from "../src/state/translationService"
import { AiModel_Platform_Enum } from "../src/types/aiModel"
import type { ExtensionConfig } from "../src/types/config"
import { repairExtensionConfig } from "../src/types/extensionConfigSchema"
import { normalizeImageTranslationSelection } from "../src/utils/visionModels"

vi.mock("@/messaging", () => import("./mocks/config-messaging"))

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
    it.each([undefined, "unknown-style"])(
        "uses the postal bubble when the stored style is %s",
        translationStyle => {
            const config = repairExtensionConfig(
                { ...defaultExtensionConfig, translationStyle },
                defaultExtensionConfig
            )
            expect(config.translationStyle).toBe("bubble-postal")
        }
    )

    it.each(["none", "highlight", "bubble-blue", "bubble-postal"])(
        "preserves the selected %s style when loading saved config",
        translationStyle => {
            const config = repairExtensionConfig(
                { ...defaultExtensionConfig, translationStyle },
                defaultExtensionConfig
            )
            expect(config.translationStyle).toBe(translationStyle)
        }
    )

    it("defaults reading-range translation on and preserves a stored opt-out", () => {
        expect(
            repairExtensionConfig({}, defaultExtensionConfig)
                .enableViewportTranslation
        ).toBe(true)
        expect(
            repairExtensionConfig(
                { ...defaultExtensionConfig, enableViewportTranslation: true },
                defaultExtensionConfig
            ).enableViewportTranslation
        ).toBe(true)
        expect(
            repairExtensionConfig(
                {
                    ...defaultExtensionConfig,
                    enableViewportTranslation: "true"
                },
                defaultExtensionConfig
            ).enableViewportTranslation
        ).toBe(true)
    })
    it("preserves the image switch across concurrent config updates and reload", async () => {
        const { createStore } = await import("jotai")
        const { configAtom, updateConfigAtom } = await import(
            "../src/state/config"
        )
        const { storage } = await import("#imports")
        let persisted = {
            ...defaultExtensionConfig,
            aiModelList: [validModel],
            imageTranslationModelId: validModel.id,
            imageTranslationModelName: "gpt-4o-mini"
        }
        const read = vi
            .spyOn(storage, "getItem")
            .mockImplementation(async () => persisted)
        const write = vi
            .spyOn(storage, "setItem")
            .mockImplementation(async (_key, value) => {
                persisted = value as typeof persisted
            })
        try {
            const store = createStore()
            await store.get(configAtom)
            await Promise.all([
                store.set(updateConfigAtom, {
                    enableImageTranslateButton: true
                }),
                store.set(updateConfigAtom, { detectedLanguage: "en" })
            ])
            expect(persisted.enableImageTranslateButton).toBe(true)
            expect(persisted.detectedLanguage).toBe("en")
            const adapter = createTranslationServiceStorageAdapter({
                getItem: async () => persisted,
                setItem: async () => undefined,
                removeItem: async () => undefined,
                subscribe: () => () => undefined
            })
            expect(
                (
                    await adapter.getItem(
                        "extension-config",
                        defaultExtensionConfig
                    )
                ).enableImageTranslateButton
            ).toBe(true)
        } finally {
            read.mockRestore()
            write.mockRestore()
        }
    })
    it("does not write back equivalent configs with reordered keys", async () => {
        const normalized = repairExtensionConfig(
            defaultExtensionConfig,
            defaultExtensionConfig
        )
        const reordered = Object.fromEntries(
            Object.entries(normalized).reverse()
        ) as ExtensionConfig
        const setItem = vi.fn(async () => undefined)
        let notify: ((value: ExtensionConfig) => void) | undefined
        const adapter = createTranslationServiceStorageAdapter({
            getItem: async () => reordered,
            setItem,
            removeItem: async () => undefined,
            subscribe: (_key, callback) => {
                notify = callback
                return () => undefined
            }
        })
        await adapter.getItem("extension-config", defaultExtensionConfig)
        const callback = vi.fn()
        adapter.subscribe("extension-config", callback, defaultExtensionConfig)
        for (let index = 0; index < 130; index++) {
            notify?.(reordered)
        }
        expect(callback).toHaveBeenCalledTimes(130)
        expect(setItem).not.toHaveBeenCalled()
    })

    it("keeps legacy models without an official endpoint ID valid", () => {
        const repaired = repairExtensionConfig(
            {
                ...defaultExtensionConfig,
                aiModelList: [validModel]
            },
            defaultExtensionConfig
        )

        expect(repaired.aiModelList).toEqual([validModel])
    })

    it("preserves a stored official endpoint ID during repair", () => {
        const modelWithEndpoint = {
            ...validModel,
            type: AiModel_Platform_Enum.BAILIAN,
            params: {
                ...validModel.params,
                officialEndpointId: "token-plan-intl"
            }
        }
        const repaired = repairExtensionConfig(
            {
                ...defaultExtensionConfig,
                aiModelList: [modelWithEndpoint]
            },
            defaultExtensionConfig
        )

        expect(repaired.aiModelList).toEqual([modelWithEndpoint])
    })

    it("preserves an explicitly cleared visual name through storage writes", async () => {
        const setItem = vi.fn(async () => undefined)
        const adapter = createTranslationServiceStorageAdapter({
            getItem: vi.fn(async (_key, initialValue) => initialValue),
            setItem,
            removeItem: vi.fn(async () => undefined),
            subscribe: vi.fn(() => () => undefined)
        })
        await adapter.setItem("extension-config", {
            ...defaultExtensionConfig,
            aiModelList: [validModel],
            imageTranslationModelId: validModel.id,
            imageTranslationModelName: ""
        })
        expect(setItem).toHaveBeenCalledWith(
            "extension-config",
            expect.objectContaining({
                imageTranslationModelId: validModel.id,
                imageTranslationModelName: ""
            })
        )
    })
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

    it("repairs page summary settings to safe defaults and preserves valid values", () => {
        const storedWithoutPageSummary = { ...defaultExtensionConfig }
        delete storedWithoutPageSummary.enablePageSummary
        delete storedWithoutPageSummary.pageSummaryDisabledSites

        const defaults = repairExtensionConfig(
            storedWithoutPageSummary,
            defaultExtensionConfig
        )
        const valid = repairExtensionConfig(
            {
                ...defaultExtensionConfig,
                enablePageSummary: true,
                pageSummaryDisabledSites: ["example.com"]
            },
            defaultExtensionConfig
        )
        const invalid = repairExtensionConfig(
            {
                ...defaultExtensionConfig,
                enablePageSummary: "yes",
                pageSummaryDisabledSites: ["example.com", 42]
            },
            defaultExtensionConfig
        )

        expect(defaults.enablePageSummary).toBe(false)
        expect(defaults.pageSummaryDisabledSites).toEqual([])
        expect(valid.enablePageSummary).toBe(true)
        expect(valid.pageSummaryDisabledSites).toEqual(["example.com"])
        expect(invalid.enablePageSummary).toBe(false)
        expect(invalid.pageSummaryDisabledSites).toEqual([])
    })

    it("falls back safely when the stored value is not an object", () => {
        expect(
            repairExtensionConfig("corrupted", defaultExtensionConfig)
        ).toEqual(defaultExtensionConfig)
    })

    it("preserves a legal independent image model name", () => {
        const repaired = repairExtensionConfig(
            {
                ...defaultExtensionConfig,
                imageTranslationModelName: "qwen-vl-max"
            },
            defaultExtensionConfig
        )

        expect(repaired.imageTranslationModelName).toBe("qwen-vl-max")
    })

    it("fills the visual model name from a legacy selected service", () => {
        const repaired = repairExtensionConfig(
            {
                ...defaultExtensionConfig,
                imageTranslationModelId: "bailian-service",
                imageTranslationModelName: undefined,
                aiModelList: [
                    {
                        ...validModel,
                        id: "bailian-service",
                        type: AiModel_Platform_Enum.BAILIAN,
                        params: {
                            ...validModel.params,
                            modelName: "qwen-vl-plus"
                        }
                    }
                ]
            },
            defaultExtensionConfig
        )

        expect(normalizeImageTranslationSelection(repaired)).toMatchObject({
            imageTranslationModelId: "bailian-service",
            imageTranslationModelName: "qwen-vl-plus"
        })
    })

    it("repairs a stored config for the reader without writing an old snapshot back", async () => {
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
        expect(setItem).not.toHaveBeenCalled()
    })

    it("does not let a delayed repair notification overwrite newer settings", async () => {
        let persisted = {
            ...defaultExtensionConfig,
            selectionTriggerMode: "shift"
        }
        let notify: (value: ExtensionConfig) => void = () => undefined
        const adapter = createTranslationServiceStorageAdapter({
            getItem: async () => persisted as ExtensionConfig,
            setItem: async (_key, value) => {
                persisted = value
            },
            removeItem: async () => undefined,
            subscribe: (_key, callback) => {
                notify = callback
                return () => undefined
            }
        })
        const callback = vi.fn()
        adapter.subscribe("extension-config", callback, defaultExtensionConfig)
        notify({
            ...defaultExtensionConfig,
            targetLanguage: null
        } as unknown as ExtensionConfig)
        await Promise.resolve()
        expect(persisted.selectionTriggerMode).toBe("shift")
        expect(callback).toHaveBeenCalledWith(defaultExtensionConfig)
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
