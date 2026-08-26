import type { CanvasHookError } from "@/types/canvas-hook"
import type { UnifiedRequestBody, UnifiedResponse } from "@/types/request"

import type { ImageTranslationErrorCode } from "./imageTranslationContracts"

export interface CanvasHookEventRequest {
    type: "canvas-hook-error"
    pageUrl?: string
    error: CanvasHookError
}

export interface CanvasHookEventResponse {
    success: boolean
}

export interface InjectMainWorldHookRequest {
    pageUrl?: string
}

export interface InjectMainWorldHookResponse {
    success: boolean
    injected?: boolean
    skipped?: boolean
    reason?: string
    error?: string
}

export interface TranslateImageRequest {
    imageUrl?: string
    targetLanguage: string
    /** 处理此次图片翻译的视觉模型 ID。 */
    modelId: string
    devicePixelRatio?: number
    pageUrl?: string
    requestId?: string
    canvasMeta?: {
        canvasId?: string
        sourceUrl?: string
        renderType?: "canvas-2d" | "canvas-webgl" | "unknown"
        sourceContextType?: string
        targetContextType?: string
    }
}

/**
 * 仅供返回图片 URL 的旧翻译链路使用。新结构化翻译请求必须使用 TranslateImageRequest。
 */
export interface LegacyTranslateImageRequest {
    imageUrl?: string
    targetLanguage: string
    devicePixelRatio?: number
    pageUrl?: string
    requestId?: string
    canvasMeta?: {
        canvasId?: string
        sourceUrl?: string
        renderType?: "canvas-2d" | "canvas-webgl" | "unknown"
        sourceContextType?: string
        targetContextType?: string
    }
}

export type ImageTextWritingMode = "horizontal" | "vertical"

/**
 * 归一化图片坐标，顺序为 [ymin, xmin, ymax, xmax]，每项均为 0–1000 的整数。
 */
export type NormalizedImageBox = [
    ymin: number,
    xmin: number,
    ymax: number,
    xmax: number
]

export interface ImageTranslationBlock {
    box: NormalizedImageBox
    sourceText: string
    translatedText: string
    writingMode: ImageTextWritingMode
    backgroundColor: string
    textColor: string
}

export interface ImageTranslationResult {
    sourceWidth: number
    sourceHeight: number
    modelId: string
    cacheHit: boolean
    blocks: ImageTranslationBlock[]
}

export type { ImageTranslationErrorCode } from "./imageTranslationContracts"

export interface TranslateImageSuccessResponse {
    success: true
    result: ImageTranslationResult
}

export interface TranslateImageFailureResponse {
    success: false
    errorCode: ImageTranslationErrorCode
    message: string
}

export type TranslateImageResponse =
    | TranslateImageSuccessResponse
    | TranslateImageFailureResponse

/**
 * 仅供尚未产生分块翻译结果的旧图片翻译链路使用。禁止作为新消息协议的响应。
 */
export interface LegacyTranslateImageResponse {
    success: boolean
    translatedImageUrl?: string
    error?: string
}

export interface ExtensionProtocolMap {
    "canvas-hook-event"(data: CanvasHookEventRequest): CanvasHookEventResponse
    "inject-main-world-hook"(
        data: InjectMainWorldHookRequest
    ): InjectMainWorldHookResponse
    "translate-image"(data: TranslateImageRequest): TranslateImageResponse
    "translate-image-legacy"(
        data: LegacyTranslateImageRequest
    ): LegacyTranslateImageResponse
    "translate-request"(data: UnifiedRequestBody): UnifiedResponse
}
