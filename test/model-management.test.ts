import { describe, expect, it } from "vitest"

import {
    mergeDiscoveredModels,
    migrateLegacyModel
} from "../src/model-management/catalog"
import {
    discoverModels,
    extractModelsDevCatalog,
    ModelDiscoveryError,
    parseGeminiModelResponse
} from "../src/model-management/discovery"
import {
    getGenerationBaseUrl,
    normalizeBaseUrl
} from "../src/model-management/providers"
import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"

describe("model provider configuration", () => {
    it("uses the Gemini OpenAI-compatible endpoint for generation", () => {
        expect(getGenerationBaseUrl(AiModel_Platform_Enum.GEMINI, true)).toBe(
            "https://generativelanguage.googleapis.com/v1beta/openai/"
        )
    })

    it("normalizes custom base URLs to one trailing slash", () => {
        expect(normalizeBaseUrl(" https://proxy.example.test/v1/// ")).toBe(
            "https://proxy.example.test/v1/"
        )
    })
})

describe("model discovery metadata", () => {
    it("marks remotely returned models as verified and enriches exact catalog matches", () => {
        expect(
            mergeDiscoveredModels(
                [{ id: "models/gpt-vision" }, { id: "custom-chat" }],
                [
                    {
                        id: "gpt-vision",
                        name: "GPT Vision",
                        modalities: { input: ["text", "image"] }
                    }
                ]
            )
        ).toEqual([
            {
                id: "custom-chat",
                name: "custom-chat",
                availability: "verified",
                vision: "unknown"
            },
            {
                id: "gpt-vision",
                name: "GPT Vision",
                availability: "verified",
                vision: "supported"
            }
        ])
    })

    it("uses catalog models as unverified candidates when a provider cannot list models", () => {
        expect(
            mergeDiscoveredModels(null, [
                {
                    id: "text-only",
                    name: "Text Only",
                    modalities: { input: ["text"] }
                }
            ])
        ).toEqual([
            {
                id: "text-only",
                name: "Text Only",
                availability: "catalog",
                vision: "unsupported"
            }
        ])
    })

    it("extracts provider models from the models.dev response", () => {
        expect(
            extractModelsDevCatalog(
                {
                    openai: {
                        models: {
                            "gpt-vision": {
                                name: "GPT Vision",
                                modalities: { input: ["text", "image"] }
                            }
                        }
                    }
                },
                ["openai"]
            )
        ).toEqual([
            {
                id: "gpt-vision",
                name: "GPT Vision",
                modalities: { input: ["text", "image"] }
            }
        ])
    })

    it("keeps only Gemini models that support content generation", () => {
        expect(
            parseGeminiModelResponse({
                models: [
                    {
                        name: "models/gemini-chat",
                        displayName: "Gemini Chat",
                        supportedGenerationMethods: ["generateContent"]
                    },
                    {
                        name: "models/gemini-embed",
                        displayName: "Gemini Embed",
                        supportedGenerationMethods: ["embedContent"]
                    }
                ]
            })
        ).toEqual([{ id: "gemini-chat", name: "Gemini Chat" }])
    })

    it("falls back to catalog candidates when official discovery is unavailable", async () => {
        const models = await discoverModels(
            {
                provider: AiModel_Platform_Enum.OPENAI,
                apiKey: "secret",
                isOfficial: true
            },
            {
                listOpenAiModels: async () => {
                    throw new Error("not supported")
                },
                loadCatalog: async () => [
                    {
                        id: "catalog-chat",
                        name: "Catalog Chat",
                        modalities: { input: ["text"] }
                    }
                ]
            }
        )

        expect(models).toEqual([
            {
                id: "catalog-chat",
                name: "Catalog Chat",
                availability: "catalog",
                vision: "unsupported"
            }
        ])
    })

    it("reports custom discovery failures so the UI can allow manual entry", async () => {
        await expect(
            discoverModels(
                {
                    provider: AiModel_Platform_Enum.OPENAI,
                    apiKey: "secret",
                    isOfficial: false,
                    baseUrl: "https://proxy.example.test/v1"
                },
                {
                    listOpenAiModels: async () => {
                        throw new Error("missing /models")
                    },
                    loadCatalog: async () => []
                }
            )
        ).rejects.toEqual(
            new ModelDiscoveryError(
                "DISCOVERY_UNSUPPORTED",
                "当前自定义接口不支持自动获取模型列表"
            )
        )
    })
})

describe("legacy model migration", () => {
    const baseModel: BaseModel = {
        id: "legacy",
        type: AiModel_Platform_Enum.HUOSHAN,
        enabled: true,
        name: "Legacy model",
        params: {
            apiKey: "secret",
            endpoint: "ep-legacy",
            modelName: ""
        }
    }

    it("moves a legacy Volcano endpoint into an empty model ID", () => {
        const migrated = migrateLegacyModel(baseModel)

        expect(migrated.params.modelName).toBe("ep-legacy")
        expect("endpoint" in migrated.params).toBe(false)
    })

    it("never replaces an existing model ID with a legacy endpoint", () => {
        const migrated = migrateLegacyModel({
            ...baseModel,
            params: { ...baseModel.params, modelName: "doubao-current" }
        })

        expect(migrated.params.modelName).toBe("doubao-current")
        expect("endpoint" in migrated.params).toBe(false)
    })
})
