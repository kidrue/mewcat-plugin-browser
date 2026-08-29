import { z } from "zod"

import { AiRole } from "./config"
import { TranslationStyle } from "./translationStyle"

// Zod schema for ExtensionConfig
export const ExtensionConfigSchema = z.object({
    isSelectedTranslate: z.boolean(),
    targetLanguage: z.string(),
    detectedLanguage: z.string(),
    aiRole: z.nativeEnum(AiRole),
    neverTranslateLanguages: z.array(z.string()).optional(),
    alwaysTranslateUrls: z.array(z.string()).optional(),
    neverTranslateUrls: z.array(z.string()).optional(),
    alwaysTranslateLanguages: z.array(z.string()).optional(),
    translationStyle: z
        .union([
            z.nativeEnum(TranslationStyle),
            z.literal("none"),
            z.literal("highlight"),
            z.literal("underline"),
            z.literal("background"),
            z.literal("border"),
            z.literal("shadow")
        ])
        .optional(),
    enableGoogleTranslate: z.boolean().optional(),
    enableMicrosoftTranslate: z.boolean().optional(),
    enableTencentTranslate: z.boolean().optional(),
    volcanoConfig: z.object({
        apiKey: z.string(),
        modelName: z.string(),
        baseUrl: z.string().optional(),
        enabled: z.boolean()
    }),
    aliBaiConfig: z.object({
        apiKey: z.string(),
        modelName: z.string(),
        baseUrl: z.string().optional(),
        enabled: z.boolean()
    }),
    zhipuConfig: z
        .object({
            apiKey: z.string(),
            modelName: z.string(),
            baseUrl: z.string().optional(),
            enabled: z.boolean()
        })
        .optional(),
    hunyuanConfig: z.object({
        apiKey: z.string(),
        modelName: z.string(),
        baseUrl: z.string().optional(),
        enabled: z.boolean()
    }),
    deepseekConfig: z
        .object({
            apiKey: z.string(),
            modelName: z.string(),
            baseUrl: z.string().optional(),
            enabled: z.boolean()
        })
        .optional(),
    chatgptConfig: z
        .object({
            apiKey: z.string(),
            modelName: z.string(),
            baseUrl: z.string().optional(),
            enabled: z.boolean()
        })
        .optional(),
    moonshotConfig: z
        .object({
            apiKey: z.string(),
            modelName: z.string(),
            baseUrl: z.string().optional(),
            enabled: z.boolean()
        })
        .optional(),
    geminiConfig: z
        .object({
            apiKey: z.string(),
            modelName: z.string(),
            baseUrl: z.string().optional(),
            enabled: z.boolean()
        })
        .optional(),
    maxRequestsPerSecond: z.number().optional(),
    maxTextLengthPerRequest: z.number().optional(),
    selectionTriggerMode: z.enum(["direct", "dot", "shift", "ctrl"]),
    selectionInteractionMode: z.enum(["click", "hover"]).optional(),
    selectionDisabledSites: z.array(z.string()).optional(),
    extensionEnabled: z.boolean().optional(),
    cacheEnabled: z.boolean().optional(),
    enableContext: z.boolean().optional(),
    minVisibleNodesThreshold: z.number().optional(),
    prioritizeVisibleArea: z.boolean().optional(),
    autoTranslateDelay: z.number()
})

export type ExtensionConfig = z.infer<typeof ExtensionConfigSchema>
