import { describe, expect, it } from "vitest"

import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"
import { hasUsablePageSummaryModel } from "../src/utils/pageSummary"

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

        expect(hasUsablePageSummaryModel([model])).toBe(false)
    })

    it("accepts an enabled LLM model with credentials and a model name", () => {
        expect(hasUsablePageSummaryModel([configuredModel])).toBe(true)
    })
})
