import type { ImageTranslationErrorCode } from "../messaging/imageTranslationContracts"

export class VisionProviderError extends Error {
    constructor(
        public readonly code: ImageTranslationErrorCode,
        message: string,
        public readonly status?: number
    ) {
        super(message)
        this.name = "VisionProviderError"
    }
}
