import { describe, expect, it } from "vitest"

import { translateWithVisionModel } from "../src/image-translation/providers"
import type { PreparedVisionImage } from "../src/image-translation/types"
import type { ModelGatewayRequest } from "../src/messaging/modelGatewayContracts"
import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"

const image: PreparedVisionImage = {
    mimeType: "image/webp",
    base64: "encoded-image",
    targetLanguage: "zh-CN",
    sourceWidth: 800,
    sourceHeight: 600,
    preparedWidth: 800,
    preparedHeight: 600,
    originalHash: "hash"
}

const model: BaseModel = {
    id: "vision-model",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    name: "Vision model",
    capabilities: { vision: true },
    params: {
        apiKey: "secret",
        isOfficial: true,
        modelName: "gpt-vision"
    }
}

const tokenPlanModel: BaseModel = {
    ...model,
    type: AiModel_Platform_Enum.BAILIAN,
    params: {
        ...model.params,
        officialEndpointId: "token-plan-cn"
    }
}

describe("vision model gateway client", () => {
    it("sends only the prepared image and model through the unified gateway", async () => {
        let received: ModelGatewayRequest | undefined
        const result = await translateWithVisionModel(
            image,
            model,
            async request => {
                received = request
                return {
                    success: true,
                    text: JSON.stringify({
                        blocks: [
                            {
                                box: [10.2, 20.4, 300.6, 400.8],
                                sourceText: " Hello ",
                                translatedText: " 你好 ",
                                writingMode: "horizontal"
                            }
                        ]
                    })
                }
            }
        )

        expect(received).toEqual({
            type: "generate-vision",
            model,
            image: {
                mimeType: "image/webp",
                base64: "encoded-image",
                targetLanguage: "zh-CN"
            }
        })
        expect(result).toEqual({
            sourceWidth: 800,
            sourceHeight: 600,
            blocks: [
                {
                    box: [10, 20, 301, 401],
                    sourceText: "Hello",
                    translatedText: "你好",
                    writingMode: "horizontal"
                }
            ]
        })
    })

    it.each([
        ["AUTHENTICATION_FAILED", "AUTHENTICATION_FAILED"],
        ["RATE_LIMITED", "RATE_LIMITED"],
        ["MODEL_NOT_FOUND", "MODEL_NOT_FOUND"],
        ["TIMEOUT_OR_ABORTED", "REQUEST_TIMEOUT"],
        ["INVALID_CONFIGURATION", "MODEL_UNAVAILABLE"],
        ["NETWORK_FAILURE", "PROVIDER_FAILURE"]
    ] as const)("maps gateway error %s to %s", async (gatewayCode, code) => {
        await expect(
            translateWithVisionModel(image, model, async () => ({
                success: false,
                error: { code: gatewayCode, message: "safe failure" }
            }))
        ).rejects.toMatchObject({ code })
    })

    it.each([
        [
            "AUTHENTICATION_FAILED",
            "Token Plan 认证失败，请检查当前区域的 sk-sp- 专属 API Key",
            "AUTHENTICATION_FAILED",
            "Token Plan 视觉模型认证失败，请检查当前区域的 sk-sp- 专属 API Key"
        ],
        [
            "MODEL_NOT_FOUND",
            "模型不在当前 Token Plan 套餐或地区支持范围内",
            "MODEL_NOT_FOUND",
            "模型不在当前 Token Plan 套餐或地区支持范围内"
        ],
        [
            "RATE_LIMITED",
            "请求过于频繁或 Token Plan Credits 已用尽",
            "RATE_LIMITED",
            "Token Plan 视觉模型请求过于频繁或 Credits 已用尽"
        ]
    ] as const)(
        "keeps Token Plan context for %s without exposing a supplied API key",
        async (gatewayCode, gatewayMessage, code, message) => {
            await expect(
                translateWithVisionModel(image, tokenPlanModel, async () => ({
                    success: false,
                    error: {
                        code: gatewayCode,
                        message: `${gatewayMessage} secret-api-key`
                    }
                }))
            ).rejects.toMatchObject({ code, message })
        }
    )

    it("does not infer a Token Plan channel from untrusted gateway error text", async () => {
        await expect(
            translateWithVisionModel(image, model, async () => ({
                success: false,
                error: {
                    code: "AUTHENTICATION_FAILED",
                    message: "Token Plan secret-api-key"
                }
            }))
        ).rejects.toMatchObject({
            code: "AUTHENTICATION_FAILED",
            message: "视觉模型认证失败，请检查 API Key"
        })
    })

    it("keeps malformed provider output behind the stable vision error", async () => {
        await expect(
            translateWithVisionModel(image, model, async () => ({
                success: true,
                text: "not-json"
            }))
        ).rejects.toMatchObject({ code: "MALFORMED_PROVIDER_RESPONSE" })
    })
})
