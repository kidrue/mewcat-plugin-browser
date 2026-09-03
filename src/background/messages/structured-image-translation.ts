import { storage } from "wxt/utils/storage"

import { STORAGE_NAMES, toWxtLocalStorageKey } from "@/constants/storage"
import {
    decorateBlocksWithColors,
    type VisionPixelBuffer
} from "@/image-translation"
import { VisionProviderError } from "@/image-translation/errors"
import { prepareVisionImage } from "@/image-translation/preprocess"
import { translateWithVisionModel } from "@/image-translation/providers"
import type {
    PreparedVisionImage,
    VisionTranslationResult
} from "@/image-translation/types"
import {
    createStrictImageTranslationUnavailableResponse,
    isTranslateImageRequest
} from "@/messaging/imageTranslationContracts"
import type {
    ImageTranslationResult,
    TranslateImageRequest,
    TranslateImageResponse
} from "@/messaging/protocol"
import {
    createImageTranslationCacheKey,
    getCachedImageTranslation,
    setCachedImageTranslation,
    withImageTranslationDeduplication
} from "@/translation/PictureCache"
import type { BaseModel } from "@/types/aiModel"
import type { ExtensionConfig } from "@/types/config"
import { repairAiModelList } from "@/types/extensionConfigSchema"
import { isVisionCapableModel } from "@/utils/visionModels"

import { captureImageForTranslation } from "./translate-image"

type ImageTranslationConfig = Pick<ExtensionConfig, "aiModelList">
type ClosableVisionPixelBuffer = VisionPixelBuffer & { close?: () => void }

export interface StructuredImageTranslationDependencies {
    loadConfig(): Promise<ImageTranslationConfig | null>
    capture(
        request: TranslateImageRequest,
        sender: chrome.runtime.MessageSender
    ): Promise<{ blob: Blob; capturePath?: string }>
    prepare(source: Blob, targetLanguage: string): Promise<PreparedVisionImage>
    getCache(input: {
        imageHash: string
        targetLanguage: string
        modelId: string
    }): Promise<ImageTranslationResult | null>
    setCache(
        input: { imageHash: string; targetLanguage: string; modelId: string },
        result: ImageTranslationResult
    ): Promise<void>
    deduplicate<T>(key: string, work: () => Promise<T>): Promise<T>
    translate(
        image: PreparedVisionImage,
        model: BaseModel
    ): Promise<VisionTranslationResult>
    createPixelBuffer(source: Blob): Promise<VisionPixelBuffer | null>
    decorate: typeof decorateBlocksWithColors
    isVisionCapable(model: BaseModel | undefined | null): boolean
    sendBackup(
        sender: chrome.runtime.MessageSender,
        request: TranslateImageRequest,
        response: TranslateImageResponse
    ): Promise<void>
}

const safeMessages = {
    INVALID_REQUEST: "图片翻译请求无效。",
    MODEL_NOT_FOUND: "未找到所选视觉模型。",
    MODEL_NOT_VISION_CAPABLE: "所选模型不支持图片翻译。",
    MODEL_UNAVAILABLE: "所选视觉模型当前不可用。",
    UNSUPPORTED_IMAGE: "无法处理该图片，请使用有效且不超过 10 MiB 的图片。",
    AUTHENTICATION_FAILED: "视觉模型认证失败，请检查 API Key。",
    RATE_LIMITED: "视觉模型请求过于频繁，请稍后重试。",
    REQUEST_TIMEOUT: "图片翻译请求超时，请稍后重试。",
    MALFORMED_PROVIDER_RESPONSE: "视觉模型返回的数据格式无效。",
    PROVIDER_FAILURE: "视觉模型请求失败，请稍后重试。",
    NO_TEXT: "图片中未识别到可翻译文本。",
    INTERNAL_ERROR: "图片翻译暂时不可用，请稍后重试。"
} as const

type SafeErrorCode = keyof typeof safeMessages

function failure(errorCode: SafeErrorCode): TranslateImageResponse {
    return { success: false, errorCode, message: safeMessages[errorCode] }
}

function mapError(error: unknown): SafeErrorCode {
    if (error instanceof VisionProviderError) {
        return error.code in safeMessages
            ? (error.code as SafeErrorCode)
            : "INTERNAL_ERROR"
    }
    return "INTERNAL_ERROR"
}

function validateModel(
    config: ImageTranslationConfig | null,
    modelId: string,
    isVisionCapable: StructuredImageTranslationDependencies["isVisionCapable"]
): BaseModel | TranslateImageResponse {
    const model = config?.aiModelList.find(
        candidate => candidate.id === modelId
    )
    if (!model) {
        return failure("MODEL_NOT_FOUND")
    }
    if (!isVisionCapable(model)) {
        return failure("MODEL_NOT_VISION_CAPABLE")
    }
    if (!model.enabled || !model.params.apiKey.trim()) {
        return failure("MODEL_UNAVAILABLE")
    }
    return model
}

function isFailure(
    value: BaseModel | TranslateImageResponse
): value is TranslateImageResponse {
    return "success" in value
}

function safeDevLog(_metadata: {
    requestIdSuffix?: string
    capturePath?: string
    width?: number
    height?: number
    bytes?: number
    code?: SafeErrorCode
    cacheHit?: boolean
}): void {
    if (import.meta.env.DEV) {
        // Deliberately accept only already-sanitized scalar metadata.
        void _metadata
    }
}

function closePixelBuffer(buffer: VisionPixelBuffer | null): void {
    ;(buffer as ClosableVisionPixelBuffer | null)?.close?.()
}

export function createStructuredImageTranslationHandler(
    deps: StructuredImageTranslationDependencies
) {
    return async function handle(
        request: unknown,
        sender: chrome.runtime.MessageSender
    ): Promise<TranslateImageResponse> {
        if (!isTranslateImageRequest(request)) {
            return failure("INVALID_REQUEST")
        }

        let response: TranslateImageResponse
        try {
            const modelOrFailure = validateModel(
                await deps.loadConfig(),
                request.modelId,
                deps.isVisionCapable
            )
            if (isFailure(modelOrFailure)) {
                response = modelOrFailure
            } else {
                const model = modelOrFailure
                const captured = await deps.capture(request, sender)
                const prepared = await deps.prepare(
                    captured.blob,
                    request.targetLanguage
                )
                const cacheInput = {
                    imageHash: prepared.originalHash,
                    targetLanguage: request.targetLanguage,
                    modelId: request.modelId
                }
                const cached = await deps.getCache(cacheInput)
                if (cached) {
                    response = { success: true, result: cached }
                } else {
                    response = await deps.deduplicate(
                        createImageTranslationCacheKey(cacheInput),
                        async () => {
                            const cachedInside = await deps.getCache(cacheInput)
                            if (cachedInside) {
                                return { success: true, result: cachedInside }
                            }
                            const translated = await deps.translate(
                                prepared,
                                model
                            )
                            if (translated.blocks.length === 0) {
                                return failure("NO_TEXT")
                            }

                            let pixels: VisionPixelBuffer | null = null
                            try {
                                pixels = await deps.createPixelBuffer(
                                    captured.blob
                                )
                            } catch {
                                pixels = null
                            }
                            let blocks: ImageTranslationResult["blocks"]
                            try {
                                blocks = deps.decorate(
                                    translated.blocks,
                                    pixels
                                )
                            } catch {
                                blocks = deps.decorate(translated.blocks, null)
                            } finally {
                                closePixelBuffer(pixels)
                            }
                            const result: ImageTranslationResult = {
                                sourceWidth: prepared.sourceWidth,
                                sourceHeight: prepared.sourceHeight,
                                modelId: request.modelId,
                                cacheHit: false,
                                blocks
                            }
                            await deps.setCache(cacheInput, result)
                            return { success: true, result }
                        }
                    )
                }
                safeDevLog({
                    requestIdSuffix: request.requestId?.slice(-6),
                    capturePath: captured.capturePath,
                    width: prepared.sourceWidth,
                    height: prepared.sourceHeight,
                    bytes: captured.blob.size,
                    cacheHit: response.success && response.result.cacheHit
                })
            }
        } catch (error) {
            response = failure(mapError(error))
        }

        await deps.sendBackup(sender, request, response).catch(() => {})
        if (response.success === false) {
            safeDevLog({
                requestIdSuffix: request.requestId?.slice(-6),
                code:
                    response.errorCode === "TRANSLATION_FAILED"
                        ? "INTERNAL_ERROR"
                        : (response.errorCode as SafeErrorCode)
            })
        }
        return response
    }
}

export async function createBrowserVisionPixelBuffer(
    source: Blob
): Promise<ClosableVisionPixelBuffer | null> {
    if (
        typeof createImageBitmap !== "function" ||
        typeof OffscreenCanvas === "undefined"
    ) {
        return null
    }
    const bitmap = await createImageBitmap(source)
    return {
        width: bitmap.width,
        height: bitmap.height,
        read(x, y, width, height, maxSamples) {
            const sampleLimit = Math.max(1, Math.floor(maxSamples))
            const ratio = width / height
            const sampleWidth = Math.min(
                width,
                sampleLimit,
                Math.max(1, Math.floor(Math.sqrt(sampleLimit * ratio)))
            )
            const sampleHeight = Math.min(
                height,
                Math.max(1, Math.floor(sampleLimit / sampleWidth))
            )
            const canvas = new OffscreenCanvas(sampleWidth, sampleHeight)
            const context = canvas.getContext("2d", {
                willReadFrequently: true
            })
            if (!context) {
                return null
            }
            context.drawImage(
                bitmap,
                x,
                y,
                width,
                height,
                0,
                0,
                sampleWidth,
                sampleHeight
            )
            return context.getImageData(0, 0, sampleWidth, sampleHeight).data
        },
        close() {
            bitmap.close()
        }
    } satisfies ClosableVisionPixelBuffer
}

export function createBrowserConfigLoader(
    getItem: (key: `local:${string}`) => Promise<unknown> = key =>
        storage.getItem<unknown>(key)
): () => Promise<ImageTranslationConfig | null> {
    return async () => {
        const value = await getItem(
            toWxtLocalStorageKey(STORAGE_NAMES.extensionConfig)
        )
        if (typeof value !== "object" || value === null) {
            return null
        }

        return {
            aiModelList: repairAiModelList(
                (value as { aiModelList?: unknown }).aiModelList
            )
        }
    }
}

export async function sendStrictBackup(
    sender: chrome.runtime.MessageSender,
    request: TranslateImageRequest,
    response: TranslateImageResponse
): Promise<void> {
    if (!request.requestId) {
        return
    }
    const storageKey = `__tr_result_${request.requestId}`
    const tabId = sender.tab?.id
    const writes: Promise<unknown>[] = [
        chrome.storage.local.set({ [storageKey]: response })
    ]
    if (tabId !== undefined) {
        writes.push(
            chrome.tabs.sendMessage(tabId, {
                type: "__translate_image_result__",
                requestId: request.requestId,
                response
            })
        )
    }
    await Promise.allSettled(writes)
}

const browserDependencies: StructuredImageTranslationDependencies = {
    loadConfig: createBrowserConfigLoader(),
    capture: captureImageForTranslation,
    prepare: prepareVisionImage,
    getCache: getCachedImageTranslation,
    setCache: setCachedImageTranslation,
    deduplicate: withImageTranslationDeduplication,
    translate: translateWithVisionModel,
    createPixelBuffer: createBrowserVisionPixelBuffer,
    decorate: decorateBlocksWithColors,
    isVisionCapable: isVisionCapableModel,
    sendBackup: sendStrictBackup
}

export const handleStructuredTranslateImage =
    createStructuredImageTranslationHandler(browserDependencies)

export { createStrictImageTranslationUnavailableResponse }
