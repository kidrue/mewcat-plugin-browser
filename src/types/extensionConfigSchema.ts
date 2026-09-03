import { z } from "zod"

import { AiModel_Platform_Enum } from "./aiModel"
import type { BaseModel } from "./aiModel"
import { AiRole, type ExtensionConfig } from "./config"
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
    neverTranslateLanguages: z.array(z.string()).optional(),
    alwaysTranslateUrls: z.array(z.string()).optional(),
    neverTranslateUrls: z.array(z.string()).optional(),
    alwaysTranslateLanguages: z.array(z.string()).optional(),
    translationStyle: z.nativeEnum(TranslationStyle).optional(),
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
    enableImageTranslateButton: z.boolean().optional(),
    imageTranslationModelId: z.string().optional(),
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

    return ExtensionConfigSchema.parse(repaired) as ExtensionConfig
}
