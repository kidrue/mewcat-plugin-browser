import type {
    ImageTranslationBlock,
    ImageTranslationResult,
    LegacyTranslateImageRequest,
    NormalizedImageBox,
    TranslateImageRequest,
    TranslateImageResponse
} from "./protocol"

export const imageTranslationErrorCodes = [
    "INVALID_REQUEST",
    "MODEL_NOT_FOUND",
    "MODEL_NOT_VISION_CAPABLE",
    "MODEL_UNAVAILABLE",
    "UNSUPPORTED_IMAGE",
    "AUTHENTICATION_FAILED",
    "RATE_LIMITED",
    "REQUEST_TIMEOUT",
    "MALFORMED_PROVIDER_RESPONSE",
    "PROVIDER_FAILURE",
    "NO_TEXT",
    "TRANSLATION_FAILED",
    "INTERNAL_ERROR"
] as const

export type ImageTranslationErrorCode =
    (typeof imageTranslationErrorCodes)[number]

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null

export function isNormalizedImageBox(
    value: unknown
): value is NormalizedImageBox {
    return (
        Array.isArray(value) &&
        value.length === 4 &&
        value.every(
            coordinate =>
                typeof coordinate === "number" &&
                Number.isInteger(coordinate) &&
                coordinate >= 0 &&
                coordinate <= 1000
        ) &&
        value[2] > value[0] &&
        value[3] > value[1]
    )
}

export function parseNormalizedImageBox(value: unknown): NormalizedImageBox {
    if (!isNormalizedImageBox(value)) {
        throw new TypeError(
            "图片坐标必须是由 0–1000 整数组成的 [ymin, xmin, ymax, xmax] 四元组"
        )
    }
    return value
}

const isImageTranslationBlock = (
    value: unknown
): value is ImageTranslationBlock =>
    isRecord(value) &&
    isNormalizedImageBox(value.box) &&
    typeof value.sourceText === "string" &&
    value.sourceText.trim().length > 0 &&
    typeof value.translatedText === "string" &&
    value.translatedText.trim().length > 0 &&
    (value.writingMode === "horizontal" || value.writingMode === "vertical") &&
    typeof value.backgroundColor === "string" &&
    value.backgroundColor.trim().length > 0 &&
    typeof value.textColor === "string" &&
    value.textColor.trim().length > 0

const isImageTranslationResult = (
    value: unknown,
    requireBlocks: boolean
): value is ImageTranslationResult =>
    isRecord(value) &&
    typeof value.sourceWidth === "number" &&
    Number.isFinite(value.sourceWidth) &&
    value.sourceWidth > 0 &&
    typeof value.sourceHeight === "number" &&
    Number.isFinite(value.sourceHeight) &&
    value.sourceHeight > 0 &&
    typeof value.modelId === "string" &&
    value.modelId.trim().length > 0 &&
    typeof value.cacheHit === "boolean" &&
    Array.isArray(value.blocks) &&
    (!requireBlocks || value.blocks.length > 0) &&
    value.blocks.every(isImageTranslationBlock)

export function isEmptyTranslateImageSuccessResponse(
    value: unknown
): value is Extract<TranslateImageResponse, { success: true }> {
    return (
        isRecord(value) &&
        value.success === true &&
        isImageTranslationResult(value.result, false) &&
        value.result.blocks.length === 0
    )
}

export function isTranslateImageRequest(
    value: unknown
): value is TranslateImageRequest {
    const canvasMeta =
        isRecord(value) && isRecord(value.canvasMeta) ? value.canvasMeta : null
    const hasSource =
        (isRecord(value) &&
            typeof value.imageUrl === "string" &&
            value.imageUrl.trim().length > 0) ||
        (canvasMeta &&
            ((typeof canvasMeta.sourceUrl === "string" &&
                canvasMeta.sourceUrl.trim().length > 0) ||
                (typeof canvasMeta.canvasId === "string" &&
                    canvasMeta.canvasId.trim().length > 0)))
    return (
        isRecord(value) &&
        typeof value.targetLanguage === "string" &&
        value.targetLanguage.trim().length > 0 &&
        typeof value.modelId === "string" &&
        value.modelId.trim().length > 0 &&
        hasSource
    )
}

export function isLegacyTranslateImageRequest(
    value: unknown
): value is LegacyTranslateImageRequest {
    return isRecord(value) && typeof value.targetLanguage === "string"
}

export function createStrictImageTranslationUnavailableResponse(
    request: unknown
): TranslateImageResponse {
    if (!isTranslateImageRequest(request)) {
        return {
            success: false,
            errorCode: "INVALID_REQUEST",
            message: "图片翻译请求缺少有效的视觉模型 ID"
        }
    }

    return {
        success: false,
        errorCode: "TRANSLATION_FAILED",
        message: "结构化图片翻译尚未实现"
    }
}

export function isTranslateImageResponse(
    value: unknown
): value is TranslateImageResponse {
    if (!isRecord(value)) {
        return false
    }

    if (value.success === true) {
        return isImageTranslationResult(value.result, true)
    }

    return (
        value.success === false &&
        typeof value.errorCode === "string" &&
        imageTranslationErrorCodes.includes(
            value.errorCode as ImageTranslationErrorCode
        ) &&
        typeof value.message === "string" &&
        value.message.trim().length > 0
    )
}
