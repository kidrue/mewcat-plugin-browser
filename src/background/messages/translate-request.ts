import type {
    AiHttpRequestConfig,
    GoogleTranslateRequestConfig,
    TranslationEngineRequestConfig,
    UnifiedRequestBody,
    UnifiedResponse
} from "@/types/request"

import {
    createGoogleTranslateForm,
    normalizeGoogleTranslateTimeout,
    parseGoogleTranslateResponse
} from "../lib/google-translate"

// ============================================================================
// 全局配置和工具
// ============================================================================

/** 活动的 AbortController 集合 */
const activeAbortControllers = new Set<AbortController>()
const timedOutAbortControllers = new WeakSet<AbortController>()

/** 创建带超时的 AbortController */
function createAbortController(
    timeout?: number
): [AbortController, NodeJS.Timeout | undefined] {
    const controller = new AbortController()
    let timeoutId: NodeJS.Timeout | undefined

    if (timeout) {
        timeoutId = setTimeout(() => {
            timedOutAbortControllers.add(controller)
            controller.abort()
        }, timeout)
    }

    activeAbortControllers.add(controller)
    return [controller, timeoutId]
}

/** 清理 AbortController */
function cleanupAbortController(
    controller: AbortController,
    timeoutId?: NodeJS.Timeout
): void {
    activeAbortControllers.delete(controller)
    if (timeoutId) {
        clearTimeout(timeoutId)
    }
}

/** 发送成功响应 */
function sendSuccess(
    content: string | Record<string, unknown>,
    headers?: Record<string, string>
): UnifiedResponse {
    return { content, success: true, headers }
}

/** 发送错误响应 */
function sendError(
    error: unknown,
    headers?: Record<string, string>
): UnifiedResponse {
    const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
    return {
        error: errorMessage,
        success: false,
        headers
    }
}

// ============================================================================
// AI 普通 HTTP 请求处理器
// ============================================================================

/** 处理 AI 普通 HTTP 请求 */
async function handleAiHttpRequest(
    config: AiHttpRequestConfig
): Promise<UnifiedResponse> {
    const { apiKey, baseUrl, headers = {}, timeout, ...requestBody } = config

    const [controller, timeoutId] = createAbortController(timeout)

    try {
        const response = await fetch(baseUrl, {
            method: "POST",
            headers: {
                ...headers,
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        })

        // 提取响应头
        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value
        })

        if (!response.ok) {
            const error = new Error(
                `HTTP error! status: ${response.status}`
            ) as Error & { headers?: Record<string, string> }
            error.headers = responseHeaders
            throw error
        }

        const result = await response.json()
        return sendSuccess(result, responseHeaders)
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error("Request timeout")
        }
        // 传递响应头到错误处理
        if (error && typeof error === "object" && "headers" in error) {
            const errorWithHeaders = error as {
                headers?: Record<string, string>
            }
            return sendError(error, errorWithHeaders.headers)
        }
        throw error
    } finally {
        cleanupAbortController(controller, timeoutId)
    }
}

// ============================================================================
// 翻译引擎请求处理器 (DEEPL/DEEPLX)
// ============================================================================

/** 处理翻译引擎请求 */
async function handleTranslationEngineRequest(
    config: TranslationEngineRequestConfig
): Promise<UnifiedResponse> {
    const { baseUrl, headers = {}, timeout, ...translationData } = config

    const [controller, timeoutId] = createAbortController(timeout)

    try {
        const response = await fetch(baseUrl, {
            method: "POST",
            headers: {
                ...headers,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(translationData),
            signal: controller.signal
        })

        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value
        })

        if (!response.ok) {
            const error = new Error(
                `Translation engine error! status: ${response.status}`
            ) as Error & { headers?: Record<string, string> }
            error.headers = responseHeaders
            throw error
        }

        const result = await response.json()
        return sendSuccess(result, responseHeaders)
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error("Request timeout")
        }
        if (error && typeof error === "object" && "headers" in error) {
            const errorWithHeaders = error as {
                headers?: Record<string, string>
            }
            return sendError(error, errorWithHeaders.headers)
        }
        throw error
    } finally {
        cleanupAbortController(controller, timeoutId)
    }
}

// ============================================================================
// Google Translate 网页端请求处理器
// ============================================================================

const GOOGLE_TRANSLATE_ENDPOINT =
    "https://translate.googleapis.com/translate_a/single"

async function handleGoogleTranslateRequest(
    config: GoogleTranslateRequestConfig
): Promise<UnifiedResponse> {
    const [controller, timeoutId] = createAbortController(
        normalizeGoogleTranslateTimeout(config.timeout)
    )

    try {
        const response = await fetch(GOOGLE_TRANSLATE_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: createGoogleTranslateForm({
                text: config.text,
                targetLanguage: config.targetLanguage,
                sourceLanguage: config.sourceLanguage
            }),
            signal: controller.signal
        })

        if (!response.ok) {
            throw new Error(`Google 翻译请求失败：HTTP ${response.status}`)
        }

        let result: unknown
        try {
            result = await response.json()
        } catch {
            throw new Error("Google 翻译返回了无法识别的响应")
        }
        return sendSuccess(parseGoogleTranslateResponse(result))
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(
                timedOutAbortControllers.has(controller)
                    ? "Google 翻译请求超时"
                    : "Google 翻译请求已取消"
            )
        }
        throw error
    } finally {
        cleanupAbortController(controller, timeoutId)
    }
}

// ============================================================================
// 中断请求处理器
// ============================================================================

/** 中断所有活动请求 */
function handleAbortRequest(): UnifiedResponse {
    activeAbortControllers.forEach(controller => controller.abort())
    activeAbortControllers.clear()
    return sendSuccess("All requests aborted")
}

// ============================================================================
// 主处理器
// ============================================================================

export async function handleTranslateRequest(
    body: UnifiedRequestBody
): Promise<UnifiedResponse> {
    try {
        switch (body.type) {
            case "ai_http":
                return await handleAiHttpRequest(body.config)
            case "translation_engine":
                return await handleTranslationEngineRequest(body.config)
            case "google_translate":
                return await handleGoogleTranslateRequest(body.config)
            case "abort":
                return handleAbortRequest()
            default:
                throw new Error("Unsupported request type")
        }
    } catch (error) {
        return sendError(error)
    }
}

// 导出类型以便向后兼容
export { RequestType } from "@/types/request"
export type { UnifiedRequestBody, UnifiedResponse } from "@/types/request"

// 向后兼容：导出旧的类型名称
export { RequestType as HttpType } from "@/types/request"
export type { UnifiedRequestBody as RequestBody } from "@/types/request"
export type { UnifiedResponse as ResponseBody } from "@/types/request"
