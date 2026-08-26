import type {
    ExtensionProtocolMap,
    ImageTranslationResult,
    LegacyTranslateImageRequest,
    LegacyTranslateImageResponse,
    TranslateImageRequest,
    TranslateImageResponse
} from "../src/messaging/protocol"

const result: ImageTranslationResult = {
    sourceWidth: 1,
    sourceHeight: 1,
    modelId: "vision-model",
    cacheHit: false,
    blocks: []
}

const request: TranslateImageRequest = {
    targetLanguage: "zh-CN",
    modelId: "vision-model"
}

const legacyRequest: LegacyTranslateImageRequest = {
    targetLanguage: "zh-CN"
}

const strictProtocolRequest: Parameters<
    ExtensionProtocolMap["translate-image"]
>[0] = request
const legacyProtocolRequest: Parameters<
    ExtensionProtocolMap["translate-image-legacy"]
>[0] = legacyRequest
const legacyResponse: LegacyTranslateImageResponse = {
    success: true,
    translatedImageUrl: "https://example.test/translated.png"
}

const success: TranslateImageResponse = { success: true, result }
const failure: TranslateImageResponse = {
    success: false,
    errorCode: "MODEL_NOT_FOUND",
    message: "未找到模型"
}

if (success.success) {
    success.result.blocks
}

if (!failure.success) {
    failure.errorCode
    failure.message
}

// @ts-expect-error modelId is required for every image translation request.
const missingModelId: TranslateImageRequest = { targetLanguage: "zh-CN" }
// @ts-expect-error successful responses must include a result.
const missingResult: TranslateImageResponse = { success: true }
// @ts-expect-error failed responses must include both an error code and message.
const missingFailureMessage: TranslateImageResponse = {
    success: false,
    errorCode: "MODEL_NOT_FOUND"
}

void request
void strictProtocolRequest
void legacyProtocolRequest
void legacyResponse
void missingModelId
void missingResult
void missingFailureMessage
