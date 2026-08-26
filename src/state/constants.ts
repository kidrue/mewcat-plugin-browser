import { GOOGLE_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import { type BaseModel } from "@/types"
import { AiRole, type ExtensionConfig } from "@/types/config"
import { logEnvironmentInfo } from "@/utils/environment"

// 在非生产环境中输出环境信息
logEnvironmentInfo()

const aiModelList: BaseModel[] = []

/**
 * 基础配置（不包含敏感信息）
 */
export const defaultExtensionConfig: ExtensionConfig = {
    isSelectedTranslate: true,
    detectedLanguage: "auto",
    targetLanguage: "zh-CN",
    aiRole: AiRole.DEFAULT,

    // 基本配置
    neverTranslateLanguages: ["zh-CN"],
    alwaysTranslateUrls: [],
    neverTranslateUrls: [],
    alwaysTranslateLanguages: [
        "en",
        "ja",
        "ko",
        "fr",
        "de",
        "es",
        "ru",
        "pt",
        "it",
        "ar",
        "hi",
        "th",
        "vi",
        "id",
        "ms",
        "tr",
        "nl",
        "pl",
        "uk",
        "cs",
        "sv",
        "da",
        "no",
        "fi",
        "el",
        "he",
        "ro",
        "hu",
        "bg",
        "sk",
        "sl",
        "hr",
        "sr",
        "lt",
        "lv",
        "et",
        "fa",
        "bn",
        "ta",
        "te",
        "mr",
        "gu",
        "ur",
        "sw",
        "af",
        "zh-TW"
    ],
    translationStyle: "highlight",
    autoTranslateDelay: 700,

    // 翻译服务配置 - 生产环境中不包含API密钥
    enableGoogleTranslate: true,
    enableMicrosoftTranslate: true,
    enableTencentTranslate: false, // 生产环境中默认禁用需要密钥的服务
    maxRequestsPerSecond: 3,
    maxTextLengthPerRequest: 1024,
    aiModelList,

    // 划词翻译配置
    selectionTriggerMode: "direct",
    selectionInteractionMode: "click",
    selectionDisabledSites: [],

    // 扩展配置
    extensionEnabled: true,
    cacheEnabled: true,
    currentModel: GOOGLE_TRANSLATE_MODEL_ID,

    // AI 思考能力配置
    enableThinking: false,

    // AI 智能上下文翻译配置
    enableContext: false,

    // 图片翻译配置
    enableImageTranslateButton: false,
    imageTranslationModelId: "",
    imageTranslateProvider: "系统"
}
