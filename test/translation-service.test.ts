import { describe, expect, it } from "vitest"

import { GOOGLE_TRANSLATE_MODEL_ID } from "../src/constants/translationServices"
import type { ModelGatewayRequest } from "../src/messaging/modelGatewayContracts"
import {
    hasAITranslationEnabled,
    translateBatch,
    translateText,
    type TranslationRuntimeConfig
} from "../src/translation/translationService"
import { AiModel_Platform_Enum, AiRole, type BaseModel } from "../src/types"
import { RequestType } from "../src/types/request"

const model: BaseModel = {
    id: "ai-model",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    name: "AI Model",
    params: {
        apiKey: "secret",
        isOfficial: true,
        modelName: "gpt-model"
    }
}

const createConfig = (
    currentModel = model.id,
    aiModelList = [model]
): TranslationRuntimeConfig => ({
    currentModel,
    aiModelList,
    aiRole: AiRole.DEFAULT,
    enableThinking: false
})

describe("functional translation service", () => {
    it("routes configured AI batch translation through the model gateway", async () => {
        let request: ModelGatewayRequest | undefined
        const result = await translateBatch(
            createConfig(),
            [{ role: "user", content: "Hello" }],
            "zh-CN",
            { pageTitle: "Example" },
            {
                modelGatewaySender: async value => {
                    request = value
                    return { success: true, text: "你好" }
                }
            }
        )

        expect(result).toBe("你好")
        expect(request).toMatchObject({
            type: "generate",
            model: { id: "ai-model" }
        })
    })

    it("routes the built-in Google service without invoking the model gateway", async () => {
        let modelGatewayCalled = false
        const result = await translateText(
            createConfig(GOOGLE_TRANSLATE_MODEL_ID),
            [{ role: "user", content: "Hello" }],
            "zh-CN",
            {},
            {
                modelGatewaySender: async () => {
                    modelGatewayCalled = true
                    return { success: true, text: "wrong" }
                },
                googleRequestSender: async request => {
                    expect(request.type).toBe(RequestType.GOOGLE_TRANSLATE)
                    return { success: true, content: "你好" }
                }
            }
        )

        expect(result).toBe("你好")
        expect(modelGatewayCalled).toBe(false)
    })

    it("reports AI usage only for a selected LLM model", () => {
        expect(hasAITranslationEnabled(createConfig())).toBe(true)
        expect(
            hasAITranslationEnabled(createConfig(GOOGLE_TRANSLATE_MODEL_ID))
        ).toBe(false)
        expect(
            hasAITranslationEnabled(
                createConfig("deepl", [
                    {
                        ...model,
                        id: "deepl",
                        type: AiModel_Platform_Enum.DEEPL
                    }
                ])
            )
        ).toBe(false)
    })
})
