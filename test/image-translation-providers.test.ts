import { afterEach, describe, expect, it, vi } from "vitest"

import {
    buildGeminiVisionRequest,
    buildOpenAiVisionRequest,
    parseVisionResponse,
    resolveVisionEndpoint,
    translateWithVisionModel,
    VisionProviderError,
    type PreparedVisionImage
} from "../src/image-translation"
import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"

const image: PreparedVisionImage = {
    mimeType: "image/webp",
    base64: "aW1hZ2U=",
    targetLanguage: "简体中文",
    sourceWidth: 1200,
    sourceHeight: 800
}

const block = {
    box: [10.2, -2, 1001.4, 900.6],
    sourceText: " Hello ",
    translatedText: " 你好 ",
    writingMode: "horizontal"
}

const createModel = (
    type: AiModel_Platform_Enum,
    options: Partial<BaseModel["params"]> = {}
): BaseModel => ({
    id: `${type}-vision`,
    type,
    enabled: true,
    name: "Vision model",
    capabilities: { vision: true },
    params: {
        modelName: "vision-model",
        apiKey: "test-api-key",
        isOfficial: true,
        ...options
    }
})

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    })

afterEach(() => {
    vi.useRealTimers()
})

describe("image translation vision providers", () => {
    it("builds the exact OpenAI-compatible structured multimodal request", () => {
        const request = buildOpenAiVisionRequest(
            image,
            createModel(AiModel_Platform_Enum.OPENAI, {
                modelName: "gpt-4.1-mini"
            })
        )
        const body = JSON.parse(String(request.init.body))

        expect(request.url).toBe("https://api.openai.com/v1/chat/completions")
        expect(request.init.headers).toEqual({
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json"
        })
        expect(body.model).toBe("gpt-4.1-mini")
        expect(body.messages).toEqual([
            {
                role: "user",
                content: [
                    { type: "text", text: expect.any(String) },
                    {
                        type: "image_url",
                        image_url: {
                            url: "data:image/webp;base64,aW1hZ2U="
                        }
                    }
                ]
            }
        ])
        expect(body.response_format).toMatchObject({
            type: "json_schema",
            json_schema: {
                name: "image_translation",
                strict: true,
                schema: {
                    type: "object",
                    required: ["blocks"],
                    additionalProperties: false
                }
            }
        })
        expect(
            body.response_format.json_schema.schema.properties.blocks.items
        ).toMatchObject({
            type: "object",
            required: ["box", "sourceText", "translatedText", "writingMode"],
            additionalProperties: false
        })
    })

    it("builds the exact Gemini inline-image JSON request", () => {
        const request = buildGeminiVisionRequest(
            image,
            createModel(AiModel_Platform_Enum.GEMINI, {
                modelName: "gemini-2.5-flash"
            })
        )
        const body = JSON.parse(String(request.init.body))

        expect(request.url).toBe(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
        )
        expect(request.init.headers).toEqual({
            "x-goog-api-key": "test-api-key",
            "Content-Type": "application/json"
        })
        expect(body.contents).toEqual([
            {
                role: "user",
                parts: [
                    { text: expect.any(String) },
                    {
                        inline_data: {
                            mime_type: "image/webp",
                            data: "aW1hZ2U="
                        }
                    }
                ]
            }
        ])
        expect(body.generationConfig).toMatchObject({
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                required: ["blocks"]
            }
        })
        expect(body.generationConfig).not.toHaveProperty("responseJsonSchema")
        expect(body.generationConfig.responseSchema).not.toHaveProperty(
            "additionalProperties"
        )
        expect(
            body.generationConfig.responseSchema.properties.blocks.items
        ).toMatchObject({
            type: "OBJECT",
            required: ["box", "sourceText", "translatedText", "writingMode"]
        })
        expect(
            body.generationConfig.responseSchema.properties.blocks.items
        ).not.toHaveProperty("additionalProperties")
    })

    it("resolves official, custom, trailing-slash and complete provider endpoints exactly once", () => {
        expect(
            resolveVisionEndpoint(createModel(AiModel_Platform_Enum.OPENAI))
        ).toBe("https://api.openai.com/v1/chat/completions")
        expect(
            resolveVisionEndpoint(
                createModel(AiModel_Platform_Enum.OPENAI, {
                    isOfficial: false,
                    baseUrl: " https://proxy.example/v1/ "
                })
            )
        ).toBe("https://proxy.example/v1/chat/completions")
        expect(
            resolveVisionEndpoint(
                createModel(AiModel_Platform_Enum.OPENAI, {
                    isOfficial: false,
                    baseUrl: "https://proxy.example/v1/chat/completions/"
                })
            )
        ).toBe("https://proxy.example/v1/chat/completions")
        expect(
            resolveVisionEndpoint(
                createModel(AiModel_Platform_Enum.GEMINI, {
                    modelName: "gemini 2.5/flash",
                    isOfficial: false,
                    baseUrl: " https://gemini.example/models/ "
                })
            )
        ).toBe(
            "https://gemini.example/models/gemini%202.5%2Fflash:generateContent"
        )
        expect(
            resolveVisionEndpoint(
                createModel(AiModel_Platform_Enum.GEMINI, {
                    modelName: "gemini-2.5-flash",
                    isOfficial: false,
                    baseUrl:
                        "https://gemini.example/models/gemini-2.5-flash:generateContent/"
                })
            )
        ).toBe("https://gemini.example/models/gemini-2.5-flash:generateContent")
        expect(
            resolveVisionEndpoint(
                createModel(AiModel_Platform_Enum.OPENAI, {
                    isOfficial: false,
                    baseUrl:
                        "https://proxy.example/v1/chat/completions?tenant=a#section"
                })
            )
        ).toBe("https://proxy.example/v1/chat/completions?tenant=a#section")
        expect(
            resolveVisionEndpoint(
                createModel(AiModel_Platform_Enum.OPENAI, {
                    isOfficial: false,
                    baseUrl: "https://proxy.example/v1?tenant=a#section"
                })
            )
        ).toBe("https://proxy.example/v1/chat/completions?tenant=a#section")
        expect(
            resolveVisionEndpoint(
                createModel(AiModel_Platform_Enum.GEMINI, {
                    modelName: "gemini-2.5-flash",
                    isOfficial: false,
                    baseUrl:
                        "https://gemini.example/models/gemini-2.5-flash:generateContent?alt=json#section"
                })
            )
        ).toBe(
            "https://gemini.example/models/gemini-2.5-flash:generateContent?alt=json#section"
        )
        expect(
            resolveVisionEndpoint(
                createModel(AiModel_Platform_Enum.GEMINI, {
                    modelName: "gemini-2.5-flash",
                    isOfficial: false,
                    baseUrl: "https://gemini.example/models?alt=json#section"
                })
            )
        ).toBe(
            "https://gemini.example/models/gemini-2.5-flash:generateContent?alt=json#section"
        )
    })

    it("extracts OpenAI string and structured content plus Gemini candidate text", async () => {
        const openAiModel = createModel(AiModel_Platform_Enum.OPENAI)
        const objectContent = { blocks: [{ ...block, box: [0, 0, 1, 1] }] }
        const fetches = [
            jsonResponse({
                choices: [
                    { message: { content: JSON.stringify(objectContent) } }
                ]
            }),
            jsonResponse({
                choices: [{ message: { content: objectContent } }]
            }),
            jsonResponse({
                candidates: [
                    {
                        content: {
                            parts: [{ text: JSON.stringify(objectContent) }]
                        }
                    }
                ]
            })
        ]
        const fetchImpl: typeof fetch = async () => fetches.shift() as Response

        await expect(
            translateWithVisionModel(image, openAiModel, fetchImpl)
        ).resolves.toMatchObject({ blocks: [{ sourceText: "Hello" }] })
        await expect(
            translateWithVisionModel(image, openAiModel, fetchImpl)
        ).resolves.toMatchObject({ blocks: [{ translatedText: "你好" }] })
        await expect(
            translateWithVisionModel(
                image,
                createModel(AiModel_Platform_Enum.GEMINI),
                fetchImpl
            )
        ).resolves.toMatchObject({ blocks: [{ writingMode: "horizontal" }] })
    })

    it("strips one JSON fence, normalizes boxes, filters blank text, and preserves empty blocks", () => {
        expect(
            parseVisionResponse(
                `\`\`\`json\n{"blocks":[${JSON.stringify(block)}, {"box":[0,0,0,3],"sourceText":"bad","translatedText":"坏","writingMode":"vertical"}, {"box":[0,0,2,3],"sourceText":" ","translatedText":"空","writingMode":"horizontal"}]}\n\`\`\``,
                image
            )
        ).toEqual({
            sourceWidth: 1200,
            sourceHeight: 800,
            blocks: [
                {
                    box: [10, 0, 1000, 901],
                    sourceText: "Hello",
                    translatedText: "你好",
                    writingMode: "horizontal"
                }
            ]
        })
        expect(parseVisionResponse({ blocks: [] }, image)).toEqual({
            sourceWidth: 1200,
            sourceHeight: 800,
            blocks: []
        })
    })

    it("maps malformed content to a safe stable error without provider output", () => {
        const secretResponse =
            '{"blocks":"not an array","secret":"do-not-leak"}'
        expect(() => parseVisionResponse(secretResponse, image)).toThrowError(
            VisionProviderError
        )
        try {
            parseVisionResponse(secretResponse, image)
        } catch (error) {
            expect(error).toMatchObject({ code: "MALFORMED_PROVIDER_RESPONSE" })
            expect((error as Error).message).not.toContain("do-not-leak")
        }
    })

    it("maps provider auth, rate-limit, timeout and generic failures to distinct stable errors", async () => {
        const model = createModel(AiModel_Platform_Enum.OPENAI)
        const cases: Array<[Response | Error, string]> = [
            [
                jsonResponse({ error: { message: "bad key" } }, 401),
                "AUTHENTICATION_FAILED"
            ],
            [
                jsonResponse({ error: { message: "forbidden" } }, 403),
                "AUTHENTICATION_FAILED"
            ],
            [
                jsonResponse({ error: { message: "slow down" } }, 429),
                "RATE_LIMITED"
            ],
            [new DOMException("Aborted", "AbortError"), "REQUEST_TIMEOUT"],
            [new DOMException("Timed out", "TimeoutError"), "REQUEST_TIMEOUT"],
            [
                jsonResponse({ error: { message: "server error" } }, 500),
                "PROVIDER_FAILURE"
            ]
        ]

        for (const [outcome, code] of cases) {
            const fetchImpl: typeof fetch = async () => {
                if (outcome instanceof Error) throw outcome
                return outcome
            }
            await expect(
                translateWithVisionModel(image, model, fetchImpl)
            ).rejects.toMatchObject({ code })
        }
    })

    it("aborts a pending provider request after 90 seconds with a request-local signal", async () => {
        vi.useFakeTimers()
        const fetchImpl: typeof fetch = async (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
                const signal = init?.signal
                expect(signal).toBeInstanceOf(AbortSignal)
                signal?.addEventListener("abort", () => {
                    reject(new DOMException("Timed out", "TimeoutError"))
                })
            })

        const result = translateWithVisionModel(
            image,
            createModel(AiModel_Platform_Enum.OPENAI),
            fetchImpl
        )
        const timeoutExpectation = expect(result).rejects.toMatchObject({
            code: "REQUEST_TIMEOUT"
        })
        await vi.advanceTimersByTimeAsync(90_000)
        await timeoutExpectation
    })

    it("maps a timeout while reading an already-returned response body and clears its timer", async () => {
        vi.useFakeTimers()
        const fetchImpl: typeof fetch = async (_url, init) =>
            ({
                ok: true,
                status: 200,
                text: () =>
                    new Promise<string>((_resolve, reject) => {
                        init?.signal?.addEventListener("abort", () => {
                            reject(
                                new DOMException("Timed out", "TimeoutError")
                            )
                        })
                    })
            }) as Response

        const result = translateWithVisionModel(
            image,
            createModel(AiModel_Platform_Enum.OPENAI),
            fetchImpl
        )
        const timeoutExpectation = expect(result).rejects.toMatchObject({
            code: "REQUEST_TIMEOUT"
        })
        await vi.advanceTimersByTimeAsync(90_000)
        await timeoutExpectation
        expect(vi.getTimerCount()).toBe(0)
    })

    it("retries OpenAI exactly once when structured error fields name an unsupported response_format", async () => {
        const calls: RequestInit[] = []
        const fetchImpl: typeof fetch = async (_url, init) => {
            calls.push(init ?? {})
            return calls.length === 1
                ? jsonResponse(
                      {
                          error: {
                              param: "response_format",
                              code: "unsupportedParameter"
                          }
                      },
                      400
                  )
                : jsonResponse({
                      choices: [
                          {
                              message: {
                                  content: JSON.stringify({ blocks: [] })
                              }
                          }
                      ]
                  })
        }

        await expect(
            translateWithVisionModel(
                image,
                createModel(AiModel_Platform_Enum.OPENAI),
                fetchImpl
            )
        ).resolves.toMatchObject({ blocks: [] })
        expect(calls).toHaveLength(2)
        expect(JSON.parse(String(calls[0].body)).response_format).toBeDefined()
        expect(
            JSON.parse(String(calls[1].body)).response_format
        ).toBeUndefined()
        expect(calls[0].signal).not.toBe(calls[1].signal)
    })

    it("retries local camel-case, hyphenated and plain-text unsupported response-format errors", async () => {
        const errorBodies = [
            jsonResponse(
                { error: { message: "responseFormat is unknown" } },
                400
            ),
            jsonResponse(
                { error: { message: "response-format is unsupported" } },
                400
            ),
            new Response("json_schema: unsupported", { status: 400 })
        ]
        for (const failure of errorBodies) {
            let calls = 0
            const fetchImpl: typeof fetch = async () => {
                calls += 1
                return calls === 1
                    ? failure
                    : jsonResponse({
                          choices: [
                              {
                                  message: {
                                      content: JSON.stringify({ blocks: [] })
                                  }
                              }
                          ]
                      })
            }

            await expect(
                translateWithVisionModel(
                    image,
                    createModel(AiModel_Platform_Enum.OPENAI),
                    fetchImpl
                )
            ).resolves.toMatchObject({ blocks: [] })
            expect(calls).toBe(2)
        }
    })

    it("retries when a structured-output param has an explicit message but no usable code", async () => {
        const failures = [
            {
                error: {
                    param: "response_format",
                    message: "response_format is not supported"
                }
            },
            {
                error: {
                    param: "json_schema",
                    code: null,
                    message: "unknown parameter: json_schema"
                }
            }
        ]
        for (const failure of failures) {
            let calls = 0
            const fetchImpl: typeof fetch = async () => {
                calls += 1
                return calls === 1
                    ? jsonResponse(failure, 422)
                    : jsonResponse({
                          choices: [
                              {
                                  message: {
                                      content: JSON.stringify({ blocks: [] })
                                  }
                              }
                          ]
                      })
            }

            await expect(
                translateWithVisionModel(
                    image,
                    createModel(AiModel_Platform_Enum.OPENAI),
                    fetchImpl
                )
            ).resolves.toMatchObject({ blocks: [] })
            expect(calls).toBe(2)
        }
    })

    it("retries quoted local parameter descriptions in either outcome order", async () => {
        const messages = [
            "Invalid parameter: 'response_format' of type 'json_schema' is not supported with this model.",
            'unsupported parameter "response_format"'
        ]
        for (const message of messages) {
            let calls = 0
            const fetchImpl: typeof fetch = async () => {
                calls += 1
                return calls === 1
                    ? jsonResponse({ error: { message } }, 400)
                    : jsonResponse({
                          choices: [
                              {
                                  message: {
                                      content: JSON.stringify({ blocks: [] })
                                  }
                              }
                          ]
                      })
            }

            await expect(
                translateWithVisionModel(
                    image,
                    createModel(AiModel_Platform_Enum.OPENAI),
                    fetchImpl
                )
            ).resolves.toMatchObject({ blocks: [] })
            expect(calls).toBe(2)
        }
    })

    it("does not retry generic or unrelated structured-output 400/422 responses", async () => {
        const failures = [
            jsonResponse(
                {
                    error: {
                        message:
                            "response_format was accepted; image type is unsupported"
                    }
                },
                400
            ),
            jsonResponse(
                {
                    error: {
                        message:
                            "response_format is accepted but image type is unsupported"
                    }
                },
                400
            ),
            jsonResponse(
                {
                    error: {
                        message:
                            "response_format has been accepted; image type is unsupported"
                    }
                },
                400
            ),
            jsonResponse(
                {
                    error: {
                        message:
                            "response_format had been accepted; image type is unsupported"
                    }
                },
                400
            ),
            jsonResponse(
                {
                    error: {
                        param: "image",
                        message: "response_format is unsupported"
                    }
                },
                422
            ),
            new Response(`${"x".repeat(4097)} response_format is unsupported`, {
                status: 400
            })
        ]
        for (const failure of failures) {
            let calls = 0
            const fetchImpl: typeof fetch = async () => {
                calls += 1
                return failure
            }

            await expect(
                translateWithVisionModel(
                    image,
                    createModel(AiModel_Platform_Enum.OPENAI),
                    fetchImpl
                )
            ).rejects.toMatchObject({ code: "PROVIDER_FAILURE" })
            expect(calls).toBe(1)
        }
    })

    it("retries a 422 structured json-schema error but never retries Gemini", async () => {
        let openAiCalls = 0
        const openAiFetch: typeof fetch = async () => {
            openAiCalls += 1
            return openAiCalls === 1
                ? jsonResponse(
                      {
                          error: {
                              param: "json_schema",
                              code: "unknown_parameter"
                          }
                      },
                      422
                  )
                : jsonResponse({
                      choices: [
                          {
                              message: {
                                  content: JSON.stringify({ blocks: [] })
                              }
                          }
                      ]
                  })
        }
        await expect(
            translateWithVisionModel(
                image,
                createModel(AiModel_Platform_Enum.OPENAI),
                openAiFetch
            )
        ).resolves.toMatchObject({ blocks: [] })
        expect(openAiCalls).toBe(2)

        let geminiCalls = 0
        const geminiFetch: typeof fetch = async () => {
            geminiCalls += 1
            return jsonResponse(
                {
                    error: {
                        param: "response_format",
                        code: "unsupported_parameter"
                    }
                },
                400
            )
        }
        await expect(
            translateWithVisionModel(
                image,
                createModel(AiModel_Platform_Enum.GEMINI),
                geminiFetch
            )
        ).rejects.toMatchObject({ code: "PROVIDER_FAILURE" })
        expect(geminiCalls).toBe(1)
    })
})
