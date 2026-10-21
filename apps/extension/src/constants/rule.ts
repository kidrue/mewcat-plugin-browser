/**
 * 语言检测配置
 */
export const LANGUAGE_DETECTION_CONFIG = {
    /** 支持的源语言 */
    supportedSourceLanguages: [
        "en",
        "es",
        "fr",
        "de",
        "it",
        "pt",
        "ru",
        "ja",
        "ko"
    ],
    /** 最小检测文本长度 */
    minDetectionLength: 2,
    /** 语言检测置信度阈值 */
    confidenceThreshold: 0.5,
    /** 默认源语言(当检测失败时) */
    defaultSourceLanguage: "en"
}
