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
        ["TIMEOUT_OR_ABORTED", "REQUEST_TIMEOUT"],
        ["NETWORK_FAILURE", "PROVIDER_FAILURE"]
    ] as const)("maps gateway error %s to %s", async (gatewayCode, code) => {
        await expect(
            translateWithVisionModel(image, model, async () => ({
                success: false,
                error: { code: gatewayCode, message: "safe failure" }
            }))
        ).rejects.toMatchObject({ code })
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
