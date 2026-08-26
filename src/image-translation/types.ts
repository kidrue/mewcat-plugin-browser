import type {
    ImageTextWritingMode,
    NormalizedImageBox
} from "../messaging/protocol"

export interface PreparedVisionImage {
    mimeType: string
    base64: string
    targetLanguage: string
    sourceWidth: number
    sourceHeight: number
    preparedWidth: number
    preparedHeight: number
    originalHash: string
}

export interface VisionTranslationBlock {
    box: NormalizedImageBox
    sourceText: string
    translatedText: string
    writingMode: ImageTextWritingMode
}

export interface VisionTranslationResult {
    sourceWidth: number
    sourceHeight: number
    blocks: VisionTranslationBlock[]
}

export interface VisionRequest {
    url: string
    init: RequestInit
}
