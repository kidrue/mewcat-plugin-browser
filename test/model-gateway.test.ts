import { describe, expect, it } from "vitest"

import { handleModelGatewayRequest } from "../src/background/messages/model-gateway"
import type {
    ModelGatewayGenerateRequest,
    ModelGatewayResponse
} from "../src/messaging/modelGatewayContracts"
import {
    buildModelSummary,
    buildTranslationMessages,
    translateModelBatch
} from "../src/translation/modelTranslation"
import { AiModel_Platform_Enum, AiRole, type BaseModel } from "../src/types"

const createModel = (
    type: AiModel_Platform_Enum,
    overrides: Partial<BaseModel["params"]> = {}
): BaseModel => ({
    id: "configured-model",
    type,
    enabled: true,
    name: "Configured model",
    params: {
        apiKey: "secret",
        isOfficial: true,
        modelName: "model-id",
        ...overrides
    }
})

const generateRequest = (
    model: BaseModel,
    enableThinking = false
): ModelGatewayGenerateRequest => ({
    type: "generate",
    model,
    messages: [{ role: "user", content: "hello" }],
    enableThinking
})

describe("background model gateway", () => {
    it("runs an official OpenAI-compatible model through xsAI", async () => {
        let received: Record<string, unknown> | undefined

        const response = await handleModelGatewayRequest(
            generateRequest(createModel(AiModel_Platform_Enum.OPENAI)),
            {
                generateText: async options => {
                    received = options
                    return { text: "你好" }
                }
            }
        )

        expect(response).toEqual({ success: true, text: "你好" })
        expect(received).toMatchObject({
            apiKey: "secret",
            baseURL: "https://api.openai.com/v1/",
            model: "model-id",
            messages: [{ role: "user", content: "hello" }]
        })
    })

    it("passes provider-specific thinking controls without rebuilding request bodies", async () => {
        let received: Record<string, unknown> | undefined

        await handleModelGatewayRequest(
            generateRequest(createModel(AiModel_Platform_Enum.HUOSHAN), true),
            {
                generateText: async options => {
                    received = options
                    return { text: "ok" }
                }
            }
        )

        expect(received).toMatchObject({ thinking: { type: "enabled" } })
    })

    it("does not inject Huoshan thinking fields into DeepSeek or Moonshot", async () => {
        for (const provider of [
            AiModel_Platform_Enum.DEEPSEEK,
            AiModel_Platform_Enum.MOONSHOT
        ]) {
            let received: Record<string, unknown> | undefined
            await handleModelGatewayRequest(
                generateRequest(createModel(provider), true),
                {
                    generateText: async options => {
                        received = options
                        return { text: "ok" }
                    }
                }
            )

            expect(received).not.toHaveProperty("thinking")
        }
    })

    it("maps provider authentication failures to a stable error code", async () => {
        const providerError = Object.assign(new Error("unauthorized"), {
            response: new Response(null, { status: 401 })
        })

        const response = await handleModelGatewayRequest(
            generateRequest(createModel(AiModel_Platform_Enum.OPENAI)),
            {
                generateText: async () => {
                    throw providerError
                }
            }
        )

        expect(response).toEqual({
            success: false,
            error: {
                code: "AUTHENTICATION_FAILED",
                message: "模型认证失败，请检查 API Key",
                status: 401
            }
        } satisfies ModelGatewayResponse)
    })

    it("uses the DeepL translation endpoint without pretending it is an LLM", async () => {
        let requestUrl = ""
        let requestBody: unknown
        const fetchImpl: typeof fetch = async (input, init) => {
            requestUrl = String(input)
            requestBody = JSON.parse(String(init?.body))
            return new Response(
                JSON.stringify({ translations: [{ text: "你好" }] }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                }
            )
        }

        const response = await handleModelGatewayRequest(
            {
                type: "translate-engine",
                model: createModel(AiModel_Platform_Enum.DEEPL),
                texts: ["Hello"],
                targetLanguage: "zh-CN"
            },
            { fetch: fetchImpl }
        )

        expect(requestUrl).toBe("https://api-free.deepl.com/v2/translate")
        expect(requestBody).toEqual({ text: ["Hello"], target_lang: "ZH" })
        expect(response).toEqual({ success: true, text: "你好" })
    })

    it("runs image translation through xsAI generateObject with a multimodal message", async () => {
        let received: Record<string, unknown> | undefined
        const response = await handleModelGatewayRequest(
            {
                type: "generate-vision",
                model: createModel(AiModel_Platform_Enum.GEMINI),
                image: {
                    mimeType: "image/webp",
                    base64: "encoded-image",
                    targetLanguage: "zh-CN"
                }
            },
            {
                generateObject: async options => {
                    received = options
                    return {
                        object: {
                            blocks: [
                                {
                                    box: [0, 0, 100, 100],
                                    sourceText: "Hello",
                                    translatedText: "你好",
                                    writingMode: "horizontal"
                                }
                            ]
                        }
                    }
                }
            }
        )

        expect(response.success).toBe(true)
        expect(response.success && JSON.parse(response.text)).toMatchObject({
            blocks: [{ translatedText: "你好" }]
        })
        expect(received).toMatchObject({
            apiKey: "secret",
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
            model: "model-id",
            schemaName: "image_translation",
            output: "object"
        })
        expect(received?.messages).toEqual([
            {
                role: "user",
                content: [
                    expect.objectContaining({ type: "text" }),
                    {
                        type: "image_url",
                        image_url: {
                            url: "data:image/webp;base64,encoded-image"
                        }
                    }
                ]
            }
        ])
    })

    it("falls back to xsAI generateText when a compatible endpoint rejects structured output", async () => {
        const unsupported = Object.assign(new Error("unsupported schema"), {
            response: new Response(null, { status: 400 })
        })
        let fallbackOptions: Record<string, unknown> | undefined

        const response = await handleModelGatewayRequest(
            {
                type: "generate-vision",
                model: createModel(AiModel_Platform_Enum.OPENAI),
                image: {
                    mimeType: "image/webp",
                    base64: "encoded-image",
                    targetLanguage: "zh-CN"
                }
            },
            {
                generateObject: async () => {
                    throw unsupported
                },
                generateText: async options => {
                    fallbackOptions = options
                    return { text: JSON.stringify({ blocks: [] }) }
                }
            }
        )

        expect(response).toEqual({
            success: true,
            text: JSON.stringify({ blocks: [] })
        })
        expect(fallbackOptions).toMatchObject({
            model: "model-id",
            messages: expect.any(Array)
        })
        expect(fallbackOptions).not.toHaveProperty("schema")
    })
})

describe("translation prompts", () => {
    it("builds batch messages with the configured role, page title and target language", () => {
        const messages = buildTranslationMessages(
            [{ role: "user", content: "Hello" }],
            "zh-CN",
            AiRole.DEFAULT,
            { batch: true, pageTitle: "Example" }
        )

        expect(messages[0]).toMatchObject({ role: "system" })
        expect(messages[0].content).toContain("Example")
        expect(messages[0].content).toContain("简体中文")
        expect(messages[1]).toEqual({ role: "user", content: "Hello" })
    })

    it("sends batch translation through the model gateway and returns its text", async () => {
        let received: ModelGatewayGenerateRequest | undefined
        const translated = await translateModelBatch(
            createModel(AiModel_Platform_Enum.OPENAI),
            [{ role: "user", content: "Hello" }],
            "zh-CN",
            {
                aiRole: AiRole.DEFAULT,
                enableThinking: false,
                pageTitle: "Example"
            },
            async request => {
                received = request as ModelGatewayGenerateRequest
                return { success: true, text: "你好" }
            }
        )

        expect(translated).toBe("你好")
        expect(received).toMatchObject({
            type: "generate",
            model: { id: "configured-model" },
            enableThinking: false
        })
        expect(received?.messages[0].content).toContain("Example")
    })

    it("skips summary generation for empty page content", async () => {
        let called = false
        const summary = await buildModelSummary(
            createModel(AiModel_Platform_Enum.OPENAI),
            "Example",
            "   ",
            { enableThinking: false },
            async () => {
                called = true
                return { success: true, text: "unused" }
            }
        )

        expect(summary).toBe("")
        expect(called).toBe(false)
    })
})
