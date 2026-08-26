import { AiModel_Platform_Enum, type BaseModel } from "../types/aiModel"
import { resolveVisionEndpoint } from "./endpoint"
import { VisionProviderError } from "./errors"
import { visionTranslationPrompt } from "./prompt"
import { parseVisionResponse } from "./schema"
import type {
    PreparedVisionImage,
    VisionRequest,
    VisionTranslationResult
} from "./types"

const blockJsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["box", "sourceText", "translatedText", "writingMode"],
    properties: {
        box: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "number" }
        },
        sourceText: { type: "string" },
        translatedText: { type: "string" },
        writingMode: { type: "string", enum: ["horizontal", "vertical"] }
    }
}

const openAiSchema = {
    type: "object",
    additionalProperties: false,
    required: ["blocks"],
    properties: {
        blocks: { type: "array", items: blockJsonSchema }
    }
}

const geminiSchema = {
    type: "OBJECT",
    required: ["blocks"],
    properties: {
        blocks: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                required: [
                    "box",
                    "sourceText",
                    "translatedText",
                    "writingMode"
                ],
                properties: {
                    box: {
                        type: "ARRAY",
                        minItems: 4,
                        maxItems: 4,
                        items: { type: "NUMBER" }
                    },
                    sourceText: { type: "STRING" },
                    translatedText: { type: "STRING" },
                    writingMode: {
                        type: "STRING",
                        enum: ["horizontal", "vertical"]
                    }
                }
            }
        }
    }
}

const jsonHeaders = { "Content-Type": "application/json" }

export function buildOpenAiVisionRequest(
    image: PreparedVisionImage,
    model: BaseModel,
    includeResponseFormat = true
): VisionRequest {
    const body: Record<string, unknown> = {
        model: model.params.modelName,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `${visionTranslationPrompt}\n目标语言：${image.targetLanguage}`
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${image.mimeType};base64,${image.base64}`
                        }
                    }
                ]
            }
        ]
    }
    if (includeResponseFormat) {
        body.response_format = {
            type: "json_schema",
            json_schema: {
                name: "image_translation",
                strict: true,
                schema: openAiSchema
            }
        }
    }
    return {
        url: resolveVisionEndpoint(model),
        init: {
            method: "POST",
            headers: {
                Authorization: `Bearer ${model.params.apiKey}`,
                ...jsonHeaders
            },
            body: JSON.stringify(body)
        }
    }
}

export function buildGeminiVisionRequest(
    image: PreparedVisionImage,
    model: BaseModel
): VisionRequest {
    return {
        url: resolveVisionEndpoint(model),
        init: {
            method: "POST",
            headers: {
                "x-goog-api-key": model.params.apiKey,
                ...jsonHeaders
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: `${visionTranslationPrompt}\n目标语言：${image.targetLanguage}`
                            },
                            {
                                inline_data: {
                                    mime_type: image.mimeType,
                                    data: image.base64
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: geminiSchema
                }
            })
        }
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isAbortOrTimeoutError = (value: unknown): boolean =>
    isRecord(value) &&
    (value.name === "AbortError" || value.name === "TimeoutError")

const maxErrorClassificationLength = 4096

const toClassificationText = (value: string): string =>
    value.slice(0, maxErrorClassificationLength)

const contentFromStructuredParts = (value: unknown): unknown => {
    if (!Array.isArray(value)) return undefined
    const text = value
        .filter(isRecord)
        .map(part => part.text)
        .filter((part): part is string => typeof part === "string")
        .join("")
    return text || undefined
}

const extractOpenAiContent = (body: unknown): unknown => {
    if (!isRecord(body) || !Array.isArray(body.choices)) return undefined
    const firstChoice = body.choices[0]
    if (!isRecord(firstChoice) || !isRecord(firstChoice.message))
        return undefined
    const content = firstChoice.message.content
    if (typeof content === "string" || isRecord(content)) return content
    return contentFromStructuredParts(content)
}

const extractGeminiContent = (body: unknown): unknown => {
    if (!isRecord(body) || !Array.isArray(body.candidates)) return undefined
    const candidate = body.candidates[0]
    if (!isRecord(candidate) || !isRecord(candidate.content)) return undefined
    return contentFromStructuredParts(candidate.content.parts)
}

const providerErrorDetails = (
    body: unknown
): { code?: string; message?: string; param?: string } => {
    if (typeof body === "string") {
        return { message: toClassificationText(body) }
    }
    if (!isRecord(body)) return {}
    const error = isRecord(body.error) ? body.error : body
    return {
        code: typeof error.code === "string" ? error.code : undefined,
        message:
            typeof error.message === "string"
                ? toClassificationText(error.message)
                : undefined,
        param: typeof error.param === "string" ? error.param : undefined
    }
}

const safeResponseBody = async (response: Response): Promise<unknown> => {
    try {
        const text = await response.text()
        if (!text.trim()) return undefined
        try {
            return JSON.parse(text)
        } catch {
            return text
        }
    } catch (error) {
        if (isAbortOrTimeoutError(error)) throw error
        return undefined
    }
}

const normalizeParameterName = (value: string): string =>
    value
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s.-]+/g, "_")
        .toLowerCase()

const isStructuredOutputParameter = (value: string): boolean =>
    ["response_format", "json_schema", "response_json_schema"].includes(
        normalizeParameterName(value)
    )

const isUnsupportedOrUnknown = (value: string): boolean =>
    /(^|_)(unsupported|unknown|unrecognized)(?=$|_)/.test(
        normalizeParameterName(value)
    )

const hasLocalUnsupportedMessage = (message: string): boolean => {
    const normalizedMessage = toClassificationText(message)
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    const parameter = "(?:response format|json schema)"
    const outcome = "(?:unsupported|unknown|unrecognized|not supported)"
    const acceptedParameter = new RegExp(
        `\\b${parameter}\\b\\s+(?:accepted|(?:is|was)\\s+accepted|(?:has|had)\\s+been\\s+accepted)\\b`
    )
    const parameterThenOutcome = new RegExp(
        `\\b${parameter}\\b(?:\\s+[a-z0-9]+){0,6}\\s+${outcome}\\b`
    )
    const outcomeThenParameter = new RegExp(
        `\\b${outcome}\\b(?:\\s+[a-z0-9]+){0,3}\\s+(?:parameter\\s+)?${parameter}\\b`
    )
    return (
        !acceptedParameter.test(normalizedMessage) &&
        (parameterThenOutcome.test(normalizedMessage) ||
            outcomeThenParameter.test(normalizedMessage))
    )
}

const shouldRetryWithoutResponseFormat = (
    status: number,
    responseBody: unknown
): boolean => {
    if (status !== 400 && status !== 422) return false
    const details = providerErrorDetails(responseBody)
    if (details.param) {
        if (!isStructuredOutputParameter(details.param)) return false
        return (
            (typeof details.code === "string" &&
                isUnsupportedOrUnknown(details.code)) ||
            Boolean(
                details.message && hasLocalUnsupportedMessage(details.message)
            )
        )
    }
    return Boolean(
        details.message && hasLocalUnsupportedMessage(details.message)
    )
}

const throwForHttpStatus = (status: number): never => {
    if (status === 401 || status === 403) {
        throw new VisionProviderError(
            "AUTHENTICATION_FAILED",
            "视觉模型认证失败，请检查 API Key",
            status
        )
    }
    if (status === 429) {
        throw new VisionProviderError(
            "RATE_LIMITED",
            "视觉模型请求过于频繁，请稍后重试",
            status
        )
    }
    throw new VisionProviderError(
        "PROVIDER_FAILURE",
        "视觉模型服务请求失败",
        status
    )
}

const mapFetchError = (error: unknown): VisionProviderError => {
    if (error instanceof VisionProviderError) return error
    if (isAbortOrTimeoutError(error)) {
        return new VisionProviderError(
            "REQUEST_TIMEOUT",
            "视觉模型请求超时或已取消"
        )
    }
    return new VisionProviderError("PROVIDER_FAILURE", "视觉模型网络请求失败")
}

async function executeRequest(
    request: VisionRequest,
    fetchImpl: typeof fetch
): Promise<{ body: unknown; response: Response }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90_000)
    try {
        const response = await fetchImpl(request.url, {
            ...request.init,
            signal: controller.signal
        })
        const body = await safeResponseBody(response)
        return { body, response }
    } catch (error) {
        throw mapFetchError(error)
    } finally {
        clearTimeout(timeout)
    }
}

export async function translateWithVisionModel(
    image: PreparedVisionImage,
    model: BaseModel,
    fetchImpl: typeof fetch = fetch
): Promise<VisionTranslationResult> {
    const isGemini = model.type === AiModel_Platform_Enum.GEMINI
    const request = isGemini
        ? buildGeminiVisionRequest(image, model)
        : buildOpenAiVisionRequest(image, model)
    const first = await executeRequest(request, fetchImpl)

    if (!first.response.ok) {
        if (
            !isGemini &&
            shouldRetryWithoutResponseFormat(first.response.status, first.body)
        ) {
            const fallback = await executeRequest(
                buildOpenAiVisionRequest(image, model, false),
                fetchImpl
            )
            if (!fallback.response.ok)
                throwForHttpStatus(fallback.response.status)
            const fallbackContent = extractOpenAiContent(fallback.body)
            if (fallbackContent === undefined) {
                throw new VisionProviderError(
                    "MALFORMED_PROVIDER_RESPONSE",
                    "视觉模型返回的结构化结果格式无效"
                )
            }
            return parseVisionResponse(fallbackContent, image)
        }
        throwForHttpStatus(first.response.status)
    }

    const content = isGemini
        ? extractGeminiContent(first.body)
        : extractOpenAiContent(first.body)
    if (content === undefined) {
        throw new VisionProviderError(
            "MALFORMED_PROVIDER_RESPONSE",
            "视觉模型返回的结构化结果格式无效"
        )
    }
    return parseVisionResponse(content, image)
}
