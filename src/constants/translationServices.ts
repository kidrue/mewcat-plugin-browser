// 翻译服务相关常量

import { AiModel_Platform_Enum } from "@/types"

export const GOOGLE_TRANSLATE_MODEL_ID = "google-translate"

export interface TranslationService {
    key: string
    name: string
    description: string
    type: AiModel_Platform_Enum
}

// 免费翻译服务
// export const FREE_TRANSLATION_SERVICES: TranslationService[] = [
//     {
//         key: "google",
//         name: "谷歌翻译",
//         description: "使用Google Translate API进行翻译",
//         type: "free"
//     },
//     {
//         key: "microsoft",
//         name: "微软翻译",
//         description: "使用Microsoft Translator进行翻译",
//         type: "free"
//     },
//     {
//         key: "tencent",
//         name: "腾讯交互翻译",
//         description: "使用腾讯翻译API进行翻译",
//         type: "free"
//     }
// ]

// AI翻译服务
export const AI_TRANSLATION_SERVICES: TranslationService[] = [
    {
        key: "volcano",
        name: "火山引擎",
        description: "使用火山引擎AI进行翻译",
        type: AiModel_Platform_Enum.HUOSHAN
    },
    {
        key: "aliBaiLian",
        name: "通义千问",
        description: "使用通义千问AI进行翻译",
        type: AiModel_Platform_Enum.BAILIAN
    },
    {
        key: "zhipu",
        name: "智谱",
        description: "使用智谱AI进行翻译",
        type: AiModel_Platform_Enum.ZHIPU
    },
    {
        key: "hunyuan",
        name: "混元",
        description: "使用混元AI进行翻译",
        type: AiModel_Platform_Enum.HUNYUAN
    },
    {
        key: "deepseek",
        name: "DeepSeek",
        description: "使用DeepSeek AI进行翻译",
        type: AiModel_Platform_Enum.DEEPSEEK
    },
    {
        key: "openai",
        name: "ChatGPT",
        description: "使用OpenAI ChatGPT进行翻译",
        type: AiModel_Platform_Enum.OPENAI
    },
    {
        key: "moonshot",
        name: "Moonshot",
        description: "使用Moonshot AI进行翻译",
        type: AiModel_Platform_Enum.MOONSHOT
    },
    {
        key: "gemini",
        name: "Gemini",
        description: "使用Gemini AI进行翻译",
        type: AiModel_Platform_Enum.GEMINI
    },
    {
        key: "deepl",
        name: "DeepL",
        description: "使用DeepL进行翻译",
        type: AiModel_Platform_Enum.DEEPL
    },
    {
        key: "deeplx",
        name: "DeepLX",
        description: "使用DeepLX进行翻译",
        type: AiModel_Platform_Enum.DEEPLX
    }
]

// 所有翻译服务
export const ALL_TRANSLATION_SERVICES = [...AI_TRANSLATION_SERVICES]

export const platformNameMap: Record<AiModel_Platform_Enum, string> = {
    [AiModel_Platform_Enum.HUOSHAN]: "火山引擎",
    [AiModel_Platform_Enum.BAILIAN]: "阿里百炼",
    [AiModel_Platform_Enum.ZHIPU]: "智谱",
    [AiModel_Platform_Enum.HUNYUAN]: "混元",
    [AiModel_Platform_Enum.DEEPSEEK]: "DeepSeek",
    [AiModel_Platform_Enum.OPENAI]: "ChatGPT",
    [AiModel_Platform_Enum.MOONSHOT]: "Moonshot",
    [AiModel_Platform_Enum.GEMINI]: "Gemini",
    [AiModel_Platform_Enum.DEEPL]: "DeepL",
    [AiModel_Platform_Enum.DEEPLX]: "DeepLX"
}
