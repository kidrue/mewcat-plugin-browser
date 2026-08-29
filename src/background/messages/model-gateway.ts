import { generateObject } from "@xsai/generate-object"
import { generateText } from "@xsai/generate-text"

import { visionTranslationPrompt } from "@/image-translation/prompt"
import { visionTranslationSchema } from "@/image-translation/schema"
import type {
    ModelGatewayErrorCode,
    ModelGatewayFailureResponse,
    ModelGatewayGenerateRequest,
    ModelGatewayGenerateVisionRequest,
    ModelGatewayRequest,
    ModelGatewayResponse,
    ModelGatewayTranslateEngineRequest
} from "@/messaging/modelGatewayContracts"
import { getGenerationBaseUrl } from "@/model-management/providers"
import { AiModel_Platform_Enum } from "@/types/aiModel"

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000
const activeControllers = new Set<AbortController>()
const timedOutControllers = new WeakSet<AbortController>()

type GenerateTextLike = (
    options: Record<string, unknown>
) => Promise<{ text?: string }>

type GenerateObjectLike = (
    options: Record<string, unknown>
) => Promise<{ object?: unknown }>

export interface ModelGatewayDependencies {
    generateText?: GenerateTextLike
    generateObject?: GenerateObjectLike
    fetch?: typeof fetch
}

const getThinkingOptions = (
    provider: AiModel_Platform_Enum,
    enabled: boolean
): Record<string, unknown> => {
    switch (provider) {
        case AiModel_Platform_Enum.GEMINI:
            return { reasoningEffort: enabled ? "high" : "minimal" }
        case AiModel_Platform_Enum.HUOSHAN:
            return { thinking: { type: enabled ? "enabled" : "disabled" } }
        case AiModel_Platform_Enum.BAILIAN:
            return { enableThinking: enabled }
        default:
            return {}
    }
}

const createController = (
    timeoutMs = DEFAULT_TIMEOUT_MS
): {
    controller: AbortController
    timeoutId: ReturnType<typeof setTimeout>
} => {
    const controller = new AbortController()
    activeControllers.add(controller)
    const timeoutId = setTimeout(() => {
        timedOutControllers.add(controller)
        controller.abort()
    }, timeoutMs)
    return { controller, timeoutId }
}

const cleanupController = (
    controller: AbortController,
    timeoutId: ReturnType<typeof setTimeout>
) => {
    clearTimeout(timeoutId)
    activeControllers.delete(controller)
}

const getHttpStatus = (error: unknown): number | undefined => {
    if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        error.response instanceof Response
    ) {
        return error.response.status
    }
    return undefined
}

const failure = (
    code: ModelGatewayErrorCode,
    message: string,
    status?: number
): ModelGatewayFailureResponse => ({
    success: false,
    error: { code, message, ...(status === undefined ? {} : { status }) }
})

const mapGatewayError = (
    error: unknown,
    controller: AbortController
): ModelGatewayFailureResponse => {
    const status = getHttpStatus(error)
    if (status === 401 || status === 403) {
        return failure(
            "AUTHENTICATION_FAILED",
            "模型认证失败，请检查 API Key",
            status
        )
    }
    if (status === 404) {
        return failure(
            "MODEL_NOT_FOUND",
            "所选模型不存在或当前账号无权访问",
            status
        )
    }
    if (status === 429) {
        return failure("RATE_LIMITED", "模型请求过于频繁，请稍后重试", status)
    }
    if (controller.signal.aborted) {
        return failure(
            "TIMEOUT_OR_ABORTED",
            timedOutControllers.has(controller)
                ? "模型请求超时"
                : "模型请求已取消"
        )
    }
    return failure(
        "NETWORK_FAILURE",
        error instanceof Error ? error.message : "模型网络请求失败",
        status
    )
}

async function handleGenerate(
    request: ModelGatewayGenerateRequest,
    dependencies: ModelGatewayDependencies
): Promise<ModelGatewayResponse> {
    const { controller, timeoutId } = createController(request.timeoutMs)
    try {
        const runGenerateText: GenerateTextLike =
            dependencies.generateText ??
            (options =>
                generateText(
                    options as Parameters<typeof generateText>[0]
                ) as Promise<{ text?: string }>)
        const text = (
            await runGenerateText({
                apiKey: request.model.params.apiKey,
                baseURL: getGenerationBaseUrl(
                    request.model.type,
                    request.model.params.isOfficial !== false,
                    request.model.params.baseUrl
                ),
                model: request.model.params.modelName,
                messages: request.messages,
                abortSignal: controller.signal,
                ...getThinkingOptions(
                    request.model.type,
                    request.enableThinking ?? false
                )
            })
        ).text?.trim()

        return text
            ? { success: true, text }
            : failure("INVALID_RESPONSE", "模型未返回有效文本")
    } catch (error) {
        return mapGatewayError(error, controller)
    } finally {
        cleanupController(controller, timeoutId)
    }
}

const getVisionMessages = (request: ModelGatewayGenerateVisionRequest) => [
    {
        role: "user" as const,
        content: [
            {
                type: "text" as const,
                text: `${visionTranslationPrompt}\n目标语言：${request.image.targetLanguage}`
            },
            {
                type: "image_url" as const,
                image_url: {
                    url: `data:${request.image.mimeType};base64,${request.image.base64}`
                }
            }
        ]
    }
]

async function handleGenerateVision(
    request: ModelGatewayGenerateVisionRequest,
    dependencies: ModelGatewayDependencies
): Promise<ModelGatewayResponse> {
    const { controller, timeoutId } = createController(
        request.timeoutMs ?? 90_000
    )
    const commonOptions = {
        apiKey: request.model.params.apiKey,
        baseURL: getGenerationBaseUrl(
            request.model.type,
            request.model.params.isOfficial !== false,
            request.model.params.baseUrl
        ),
        model: request.model.params.modelName,
        messages: getVisionMessages(request),
        abortSignal: controller.signal
    }
    try {
        const runGenerateObject: GenerateObjectLike =
            dependencies.generateObject ??
            (options =>
                generateObject(
                    options as unknown as Parameters<typeof generateObject>[0]
                ) as Promise<{ object?: unknown }>)
        const result = await runGenerateObject({
            ...commonOptions,
            schema: visionTranslationSchema,
            schemaName: "image_translation",
            schemaDescription: "漫画图片文字检测与翻译结果",
            output: "object",
            strict: true
        })
        return result.object === undefined
            ? failure("INVALID_RESPONSE", "视觉模型未返回有效结构化结果")
            : { success: true, text: JSON.stringify(result.object) }
    } catch (error) {
        const status = getHttpStatus(error)
        if (status === 400 || status === 422) {
            try {
                const runGenerateText: GenerateTextLike =
                    dependencies.generateText ??
                    (options =>
                        generateText(
                            options as Parameters<typeof generateText>[0]
                        ) as Promise<{ text?: string }>)
                const text = (await runGenerateText(commonOptions)).text?.trim()
                return text
                    ? { success: true, text }
                    : failure(
                          "INVALID_RESPONSE",
                          "视觉模型未返回有效结构化结果"
                      )
            } catch (fallbackError) {
                return mapGatewayError(fallbackError, controller)
            }
        }
        return mapGatewayError(error, controller)
    } finally {
        cleanupController(controller, timeoutId)
    }
}

const toDeepLLanguageCode = (language: string): string => {
    const languageMap: Record<string, string> = {
        "zh-CN": "ZH",
        "zh-TW": "ZH",
        zh: "ZH",
        en: "EN",
        "en-US": "EN-US",
        "en-GB": "EN-GB",
        ja: "JA",
        ko: "KO"
    }
    return languageMap[language] ?? language.toUpperCase()
}

async function handleTranslationEngine(
    request: ModelGatewayTranslateEngineRequest,
    dependencies: ModelGatewayDependencies
): Promise<ModelGatewayResponse> {
    const { controller, timeoutId } = createController(request.timeoutMs)
    const fetchImpl = dependencies.fetch ?? fetch
    const isDeepLX = request.model.type === AiModel_Platform_Enum.DEEPLX
    const baseUrl = getGenerationBaseUrl(
        request.model.type,
        request.model.params.isOfficial !== false,
        request.model.params.baseUrl
    ).replace(/\/$/, "")
    const url = isDeepLX
        ? baseUrl.includes("/translate")
            ? baseUrl
            : `${baseUrl}/${request.model.params.apiKey}/translate`
        : `${baseUrl}/translate`

    try {
        const response = await fetchImpl(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(isDeepLX
                    ? {}
                    : {
                          Authorization: `DeepL-Auth-Key ${request.model.params.apiKey}`
                      })
            },
            body: JSON.stringify(
                isDeepLX
                    ? {
                          text: request.texts.join("\n"),
                          source_lang: "auto",
                          target_lang: toDeepLLanguageCode(
                              request.targetLanguage
                          )
                      }
                    : {
                          text: request.texts,
                          target_lang: toDeepLLanguageCode(
                              request.targetLanguage
                          )
                      }
            ),
            signal: controller.signal
        })
        if (!response.ok) {
            const providerError = Object.assign(
                new Error(`HTTP ${response.status}`),
                { response }
            )
            throw providerError
        }
        const body = (await response.json()) as {
            code?: number
            data?: string
            translations?: Array<{ text?: string }>
        }
        const text = isDeepLX
            ? body.code === 200
                ? body.data?.trim()
                : undefined
            : body.translations
                  ?.map(item => item.text?.trim() ?? "")
                  .filter(Boolean)
                  .join("\n")
        return text
            ? { success: true, text }
            : failure("INVALID_RESPONSE", "翻译引擎未返回有效文本")
    } catch (error) {
        return mapGatewayError(error, controller)
    } finally {
        cleanupController(controller, timeoutId)
    }
}

export async function handleModelGatewayRequest(
    request: ModelGatewayRequest,
    dependencies: ModelGatewayDependencies = {}
): Promise<ModelGatewayResponse> {
    if (request.type === "abort") {
        activeControllers.forEach(controller => controller.abort())
        activeControllers.clear()
        return { success: true, text: "" }
    }
    if (request.type === "translate-engine") {
        return handleTranslationEngine(request, dependencies)
    }
    return request.type === "generate-vision"
        ? handleGenerateVision(request, dependencies)
        : handleGenerate(request, dependencies)
}
