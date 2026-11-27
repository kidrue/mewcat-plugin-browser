import { z } from "zod"

import { isValidKeyboardShortcut } from "@/utils/keyboardShortcut"

import { AiModel_Platform_Enum } from "./aiModel"
import type { BaseModel } from "./aiModel"
import {
    AiRole,
    MEWCAT_TRANSLATION_PROMPT_MAX_LENGTH,
    type ExtensionConfig
} from "./config"
import { TranslationStyle } from "./translationStyle"

export const BaseModelSchema = z.object({
    id: z.string().min(1),
    type: z.nativeEnum(AiModel_Platform_Enum),
    enabled: z.boolean(),
    name: z.string(),
    capabilities: z.object({ vision: z.boolean().optional() }).optional(),
    params: z.object({
        modelName: z.string(),
        isOfficial: z.boolean().optional(),
        officialEndpointId: z.string().optional(),
        baseUrl: z.string().optional(),
        endpoint: z.string().optional(),
        apiKey: z.string()
    })
})

const extensionConfigShape = {
    isSelectedTranslate: z.boolean(),
    targetLanguage: z.string(),
    detectedLanguage: z.string(),
    aiRole: z.nativeEnum(AiRole),
    enableAutoAiRole: z.boolean().optional(),
    mewcatTranslationPrompt: z
        .string()
        .max(MEWCAT_TRANSLATION_PROMPT_MAX_LENGTH)
        .optional(),
    neverTranslateLanguages: z.array(z.string()).optional(),
    alwaysTranslateUrls: z.array(z.string()).optional(),
    neverTranslateUrls: z.array(z.string()).optional(),
    alwaysTranslateLanguages: z.array(z.string()).optional(),
    translationStyle: z.nativeEnum(TranslationStyle).optional(),
    translationDisplayMode: z.enum(["bilingual", "translation"]).optional(),
    enableParagraphTranslation: z.boolean().optional(),
    enableParagraphHoverPreview: z.boolean().optional(),
    paragraphTranslationShortcut: z
        .string()
        .refine(isValidKeyboardShortcut)
        .optional(),
    enableGoogleTranslate: z.boolean().optional(),
    enableMicrosoftTranslate: z.boolean().optional(),
    enableTencentTranslate: z.boolean().optional(),
    aiModelList: z.array(BaseModelSchema),
    maxRequestsPerSecond: z.number().finite().positive().optional(),
    maxTextLengthPerRequest: z.number().finite().positive().optional(),
    selectionTriggerMode: z.enum(["direct", "dot", "shift", "ctrl"]),
    selectionInteractionMode: z.enum(["click", "hover"]).optional(),
    selectionDisabledSites: z.array(z.string()).optional(),
    extensionEnabled: z.boolean().optional(),
    cacheEnabled: z.boolean().optional(),
    minVisibleNodesThreshold: z.number().finite().nonnegative().optional(),
    prioritizeVisibleArea: z.boolean().optional(),
    enableViewportTranslation: z.boolean().optional(),
    autoTranslateDelay: z.number().finite().nonnegative(),
    currentModel: z.string().optional(),
    customProtectionRegexps: z.array(z.string()).optional(),
    enableTextProtection: z.boolean().optional(),
    placeholderDelimiters: z
        .union([
            z.tuple([z.string(), z.string()]),
            z.tuple([z.string(), z.string(), z.string()])
        ])
        .optional(),
    enableThinking: z.boolean().optional(),
    enableContext: z.boolean().optional(),
    enablePageSummary: z.boolean().optional(),
    pageSummaryShortcut: z
        .string()
        .refine(value => value === "" || isValidKeyboardShortcut(value))
        .optional(),
    pageSummaryDisabledSites: z.array(z.string()).optional(),
    enableImageTranslateButton: z.boolean().optional(),
    imageTranslationModelId: z.string().optional(),
    imageTranslationModelName: z.string().optional(),
    imageTranslateProvider: z.string().optional()
} satisfies z.ZodRawShape

export const ExtensionConfigSchema = z.object(extensionConfigShape)

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

export function repairAiModelList(value: unknown): BaseModel[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value.flatMap(model => {
        const result = BaseModelSchema.safeParse(model)
        return result.success ? [result.data] : []
    })
}

export function repairExtensionConfig(
    value: unknown,
    defaults: ExtensionConfig
): ExtensionConfig {
    const source = isRecord(value) ? value : {}
    const defaultValues = defaults as unknown as Record<string, unknown>
    const repaired: Record<string, unknown> = {}

    for (const [key, schema] of Object.entries(extensionConfigShape)) {
        // 已存储的模型选择损坏时保持未选择，不能自动改用默认服务。
        if (key === "currentModel") {
            repaired[key] = typeof source[key] === "string" ? source[key] : ""
            continue
        }
        // Preserve absence for one-time legacy image model migration.
        if (
            key === "imageTranslationModelName" &&
            source[key] === undefined &&
            typeof source.imageTranslationModelId === "string" &&
            source.imageTranslationModelId.trim()
        ) {
            continue
        }
        if (key === "aiModelList" && Array.isArray(source[key])) {
            repaired[key] = repairAiModelList(source[key])
            continue
        }

        const result = schema.safeParse(source[key])
        if (result.success && result.data !== undefined) {
            repaired[key] = result.data
            continue
        }

        const fallback = schema.safeParse(defaultValues[key])
        if (fallback.success && fallback.data !== undefined) {
            repaired[key] = fallback.data
        }
    }

    // 保留已有段落快捷键，避免升级或导入后两个功能使用同一按键。
    if (
        repaired.pageSummaryShortcut &&
        repaired.pageSummaryShortcut === repaired.paragraphTranslationShortcut
    ) {
        repaired.pageSummaryShortcut = ""
    }

    return ExtensionConfigSchema.parse(repaired) as ExtensionConfig
}
