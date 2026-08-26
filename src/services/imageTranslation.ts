import { nanoid } from "nanoid"

import { sendMessage } from "@/messaging"
import {
    isEmptyTranslateImageSuccessResponse,
    isTranslateImageResponse
} from "@/messaging/imageTranslationContracts"
import type {
    ImageTranslationErrorCode,
    ImageTranslationResult,
    LegacyTranslateImageRequest,
    LegacyTranslateImageResponse,
    TranslateImageRequest,
    TranslateImageResponse
} from "@/messaging/protocol"

export { validateImage } from "@/utils/imageUtils"

const TRANSLATE_TIMEOUT_MS = 90_000

const strictImageErrorMessages: Record<ImageTranslationErrorCode, string> = {
    INVALID_REQUEST: "图片翻译请求无效",
    MODEL_NOT_FOUND: "未找到所选视觉模型",
    MODEL_NOT_VISION_CAPABLE: "所选模型不支持图片翻译",
    MODEL_UNAVAILABLE: "所选视觉模型当前不可用",
    UNSUPPORTED_IMAGE: "暂不支持此图片",
    AUTHENTICATION_FAILED: "视觉模型认证失败",
    RATE_LIMITED: "请求过于频繁，请稍后重试",
    REQUEST_TIMEOUT: "翻译超时，请重试",
    MALFORMED_PROVIDER_RESPONSE: "视觉模型返回格式无效",
    PROVIDER_FAILURE: "视觉模型请求失败",
    NO_TEXT: "图片中未识别到可翻译文字",
    TRANSLATION_FAILED: "图片翻译失败",
    INTERNAL_ERROR: "图片翻译失败"
}

const sendLegacyTranslateImageMessage = (
    request: LegacyTranslateImageRequest
): Promise<LegacyTranslateImageResponse> =>
    sendMessage("translate-image-legacy", request)

const sendStructuredTranslateImageMessage = (
    request: TranslateImageRequest
): Promise<TranslateImageResponse> => sendMessage("translate-image", request)

/**
 * Requests a structured image translation without exposing the legacy raster
 * result path to new content-script callers.
 */
export function translateStructuredImageViaBackground(params: {
    imageUrl?: string
    targetLanguage: string
    modelId: string
    devicePixelRatio?: number
    pageUrl?: string
    canvasMeta?: TranslateImageRequest["canvasMeta"]
}): Promise<ImageTranslationResult> {
    const modelId = params.modelId.trim()
    if (!modelId) {
        return Promise.reject(new Error("请选择视觉模型后再翻译图片"))
    }

    const requestId = `tr_${Date.now()}_${nanoid(36).slice(2, 8)}`
    const storageKey = `__tr_result_${requestId}`
    return new Promise<ImageTranslationResult>((resolve, reject) => {
        let settled = false
        const settle = (callback: () => void) => {
            if (settled) {
                return
            }
            settled = true
            clearTimeout(timer)
            chrome.runtime.onMessage.removeListener(messageListener)
            chrome.storage.onChanged.removeListener(storageListener)
            chrome.storage.local.remove(storageKey).catch(() => {})
            callback()
        }
        const handleResponse = (response: unknown) => {
            if (isEmptyTranslateImageSuccessResponse(response)) {
                settle(() =>
                    reject(new Error(strictImageErrorMessages.NO_TEXT))
                )
                return
            }
            if (!isTranslateImageResponse(response)) {
                return
            }
            if (response.success === true) {
                settle(() => resolve(response.result))
                return
            }
            settle(() =>
                reject(
                    new Error(
                        strictImageErrorMessages[response.errorCode] ||
                            "图片翻译失败"
                    )
                )
            )
        }
        const timer = setTimeout(() => {
            settle(() => reject(new Error("翻译超时，请重试")))
        }, TRANSLATE_TIMEOUT_MS)
        const storageListener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string
        ) => {
            if (area === "local" && changes[storageKey]?.newValue) {
                handleResponse(changes[storageKey].newValue)
            }
        }
        const messageListener = (message: Record<string, unknown>) => {
            if (
                message?.type === "__translate_image_result__" &&
                message?.requestId === requestId
            ) {
                handleResponse(message.response)
            }
        }
        chrome.storage.onChanged.addListener(storageListener)
        chrome.runtime.onMessage.addListener(messageListener)
        sendStructuredTranslateImageMessage({
            imageUrl: params.imageUrl,
            targetLanguage: params.targetLanguage,
            modelId,
            devicePixelRatio: params.devicePixelRatio,
            pageUrl: params.pageUrl,
            requestId,
            canvasMeta: params.canvasMeta
        })
            .then(handleResponse)
            .catch(() => {
                // The tab/storage channels are independently reliable backups.
            })
    })
}

/**
 * Request image translation via background service worker.
 * All network operations happen in the background to avoid CORS issues.
 *
 * Uses triple-channel response for reliability:
 * 1. Primary: typed extension messaging
 * 2. Message: chrome.tabs.sendMessage from background
 * 3. Storage: chrome.storage.local — completely bypasses messaging
 *
 * In dev mode (HMR) or MV3 edge cases, messaging channels can break.
 * The storage channel ensures the result still arrives.
 */
export function translateImageViaBackground(params: {
    imageUrl?: string
    targetLanguage: string
    devicePixelRatio: number
    pageUrl?: string
    canvasMeta?: {
        canvasId?: string
        sourceUrl?: string
        renderType?: "canvas-2d" | "canvas-webgl" | "unknown"
        sourceContextType?: string
        targetContextType?: string
    }
}): Promise<string> {
    const requestId = `tr_${Date.now()}_${nanoid(36).slice(2, 8)}`
    const storageKey = `__tr_result_${requestId}`

    console.log("[ImageTranslate] 发送翻译请求:", {
        requestId,
        imageUrl: params.imageUrl?.slice(0, 80),
        targetLanguage: params.targetLanguage
    })

    return new Promise<string>((resolve, reject) => {
        let settled = false

        const settle = (fn: () => void) => {
            if (settled) {
                return
            }
            settled = true
            clearTimeout(timer)
            chrome.runtime.onMessage.removeListener(messageListener)
            chrome.storage.onChanged.removeListener(storageListener)
            chrome.storage.local.remove(storageKey).catch(() => {})
            fn()
        }

        const handleResponse = (
            response: LegacyTranslateImageResponse,
            channel: string
        ) => {
            console.log("[ImageTranslate] 收到响应 via", channel, {
                success: response.success,
                hasUrl: !!response.translatedImageUrl,
                error: response.error
            })

            if (response.success && response.translatedImageUrl) {
                settle(() => resolve(response.translatedImageUrl!))
            } else {
                settle(() =>
                    reject(new Error(response.error || "图片翻译失败"))
                )
            }
        }

        // Timeout
        const timer = setTimeout(() => {
            settle(() => reject(new Error("翻译超时，请重试")))
        }, TRANSLATE_TIMEOUT_MS)

        // Channel 3 (most reliable): chrome.storage.local
        const storageListener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string
        ) => {
            if (area === "local" && changes[storageKey]?.newValue) {
                handleResponse(
                    changes[storageKey]
                        .newValue as LegacyTranslateImageResponse,
                    "storage"
                )
            }
        }
        chrome.storage.onChanged.addListener(storageListener)

        // Channel 2: chrome.tabs.sendMessage from background
        const messageListener = (message: Record<string, unknown>) => {
            if (
                message?.type === "__translate_image_result__" &&
                message?.requestId === requestId
            ) {
                handleResponse(
                    message.response as LegacyTranslateImageResponse,
                    "tabs-message"
                )
            }
        }
        chrome.runtime.onMessage.addListener(messageListener)

        // Channel 1 (primary): typed extension messaging
        const legacyRequest: LegacyTranslateImageRequest = {
            imageUrl: params.imageUrl,
            targetLanguage: params.targetLanguage,
            devicePixelRatio: params.devicePixelRatio,
            pageUrl: params.pageUrl,
            requestId,
            canvasMeta: params.canvasMeta
        }
        sendLegacyTranslateImageMessage(legacyRequest)
            .then(response => {
                handleResponse(response, "primary")
            })
            .catch(error => {
                // Primary channel failed — wait for backup channels or timeout
                console.warn(
                    "[ImageTranslate] 主消息通道异常，等待备用通道:",
                    error?.message || error
                )
            })
    })
}
