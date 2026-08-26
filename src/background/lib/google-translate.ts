export interface GoogleTranslateFormConfig {
    text: string
    targetLanguage: string
    sourceLanguage?: string
}

export const GOOGLE_TRANSLATE_TIMEOUT_MS = 30_000

export function normalizeGoogleTranslateTimeout(timeout?: number): number {
    if (timeout === undefined || !Number.isFinite(timeout)) {
        return GOOGLE_TRANSLATE_TIMEOUT_MS
    }

    return Math.max(
        1,
        Math.min(GOOGLE_TRANSLATE_TIMEOUT_MS, Math.trunc(timeout))
    )
}

export function createGoogleTranslateForm(
    config: GoogleTranslateFormConfig
): URLSearchParams {
    return new URLSearchParams({
        client: "gtx",
        sl: config.sourceLanguage || "auto",
        tl: config.targetLanguage,
        dt: "t",
        q: config.text
    })
}

export function parseGoogleTranslateResponse(response: unknown): string {
    if (!Array.isArray(response) || !Array.isArray(response[0])) {
        throw new Error("Google 翻译返回了无法识别的响应")
    }

    const translatedParts = response[0].map(segment => {
        if (!Array.isArray(segment) || typeof segment[0] !== "string") {
            throw new Error("Google 翻译返回了无法识别的响应")
        }
        return segment[0]
    })

    if (translatedParts.length === 0) {
        throw new Error("Google 翻译返回了无法识别的响应")
    }

    return translatedParts.join("")
}
