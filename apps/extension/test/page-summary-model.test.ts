import { describe, expect, it } from "vitest"

import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"
import { selectPageSummaryModel } from "../src/utils/pageSummary"

const configuredModel: BaseModel = {
    id: "configured-model",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    name: "Configured model",
    params: {
        apiKey: "configured-key",
        modelName: "gpt-5"
    }
}

describe("page summary model availability", () => {
    it.each([
        ["DeepL", { type: AiModel_Platform_Enum.DEEPL }],
        ["DeepLX", { type: AiModel_Platform_Enum.DEEPLX }],
        ["disabled model", { enabled: false }],
        [
            "missing API key",
            { params: { ...configuredModel.params, apiKey: "   " } }
        ],
        [
            "missing model name",
            { params: { ...configuredModel.params, modelName: "   " } }
        ]
    ])("rejects %s", (_case, overrides) => {
        const model = {
            ...configuredModel,
            ...overrides
        } as BaseModel

        expect(
            selectPageSummaryModel({
                currentModel: model.id,
                aiModelList: [model]
            })
        ).toBeNull()
    })

    it("accepts an enabled LLM model with credentials and a model name", () => {
        expect(
            selectPageSummaryModel({
                currentModel: configuredModel.id,
                aiModelList: [configuredModel]
            })
        ).toBe(configuredModel)
    })

    it("uses only the selected usable model", () => {
        const fallbackModel = {
            ...configuredModel,
            id: "fallback-model"
        }

        expect(
            selectPageSummaryModel({
                currentModel: configuredModel.id,
                aiModelList: [fallbackModel, configuredModel]
            })
        ).toBe(configuredModel)

        expect(
            selectPageSummaryModel({
                currentModel: "missing-model",
                aiModelList: [
                    { ...configuredModel, enabled: false },
                    fallbackModel
                ]
            })
        ).toBeNull()
    })

    it.each([
        "mewcat-translate",
        "google-translate",
        "microsoft-translate",
        undefined
    ])("does not use another configured AI model for %s", currentModel => {
        expect(
            selectPageSummaryModel({
                currentModel,
                aiModelList: [configuredModel]
            })
        ).toBeNull()
    })

    it.each([
        { enabled: false },
        { type: AiModel_Platform_Enum.DEEPL },
        { type: AiModel_Platform_Enum.DEEPLX },
        { params: { ...configuredModel.params, apiKey: "" } },
        { params: { ...configuredModel.params, modelName: "" } }
    ])(
        "does not fall back when the selected model is unusable (%j)",
        overrides => {
            expect(
                selectPageSummaryModel({
                    currentModel: configuredModel.id,
                    aiModelList: [
                        { ...configuredModel, ...overrides },
                        { ...configuredModel, id: "other" }
                    ]
                })
            ).toBeNull()
        }
    )

    it("returns null when no usable generative model is configured", () => {
        expect(
            selectPageSummaryModel({
                currentModel: "missing-model",
                aiModelList: [
                    {
                        ...configuredModel,
                        type: AiModel_Platform_Enum.DEEPL
                    }
                ]
            })
        ).toBeNull()
    })
})
