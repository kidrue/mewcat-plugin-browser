import { AiModel_Platform_Enum } from "@/types/aiModel"

export type ProviderKind = "llm" | "translation-engine"
export type ModelDiscoveryStrategy = "openai" | "gemini" | "none"
export type OfficialEndpointMode = "pay-as-you-go" | "token-plan"

export interface OfficialEndpointDefinition {
    id: string
    label: string
    baseUrl: string
    mode: OfficialEndpointMode
    catalogFallback: "catalog" | "manual"
}

export interface ProviderEndpointSelection {
    provider: AiModel_Platform_Enum
    isOfficial: boolean
    customBaseUrl?: string
    officialEndpointId?: string
}

export class ProviderConfigurationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ProviderConfigurationError"
    }
}

export interface ProviderDefinition {
    kind: ProviderKind
    discovery: ModelDiscoveryStrategy
    generationBaseUrl: string
    catalogIds: string[]
    officialEndpoints?: OfficialEndpointDefinition[]
}

const OFFICIAL_GENERATION_BASE_URLS: Record<AiModel_Platform_Enum, string> = {
    [AiModel_Platform_Enum.HUOSHAN]:
        "https://ark.cn-beijing.volces.com/api/v3/",
    [AiModel_Platform_Enum.BAILIAN]:
        "https://dashscope.aliyuncs.com/compatible-mode/v1/",
    [AiModel_Platform_Enum.ZHIPU]: "https://open.bigmodel.cn/api/paas/v4/",
    [AiModel_Platform_Enum.HUNYUAN]:
        "https://api.hunyuan.cloud.tencent.com/v1/",
    [AiModel_Platform_Enum.DEEPSEEK]: "https://api.deepseek.com/",
    [AiModel_Platform_Enum.OPENAI]: "https://api.openai.com/v1/",
    [AiModel_Platform_Enum.MOONSHOT]: "https://api.moonshot.cn/v1/",
    [AiModel_Platform_Enum.GEMINI]:
        "https://generativelanguage.googleapis.com/v1beta/openai/",
    [AiModel_Platform_Enum.DEEPL]: "https://api-free.deepl.com/v2/",
    [AiModel_Platform_Enum.DEEPLX]: "https://api.deeplx.org/"
}

export const PROVIDER_REGISTRY: Record<
    AiModel_Platform_Enum,
    ProviderDefinition
> = {
    [AiModel_Platform_Enum.HUOSHAN]: {
        kind: "llm",
        discovery: "openai",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.HUOSHAN],
        catalogIds: ["volcengine", "bytedance"]
    },
    [AiModel_Platform_Enum.BAILIAN]: {
        kind: "llm",
        discovery: "openai",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.BAILIAN],
        catalogIds: ["alibaba"],
        officialEndpoints: [
            {
                id: "pay-as-you-go-cn",
                label: "按量付费（中国站）",
                baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
                mode: "pay-as-you-go",
                catalogFallback: "catalog"
            },
            {
                id: "token-plan-cn",
                label: "Token Plan（中国站·北京）",
                baseUrl:
                    "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/",
                mode: "token-plan",
                catalogFallback: "manual"
            },
            {
                id: "token-plan-intl",
                label: "Token Plan（国际站·新加坡）",
                baseUrl:
                    "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/",
                mode: "token-plan",
                catalogFallback: "manual"
            }
        ]
    },
    [AiModel_Platform_Enum.ZHIPU]: {
        kind: "llm",
        discovery: "openai",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.ZHIPU],
        catalogIds: ["zai", "zhipu", "zhipuai"]
    },
    [AiModel_Platform_Enum.HUNYUAN]: {
        kind: "llm",
        discovery: "openai",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.HUNYUAN],
        catalogIds: ["tencent", "hunyuan"]
    },
    [AiModel_Platform_Enum.DEEPSEEK]: {
        kind: "llm",
        discovery: "openai",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.DEEPSEEK],
        catalogIds: ["deepseek"]
    },
    [AiModel_Platform_Enum.OPENAI]: {
        kind: "llm",
        discovery: "openai",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.OPENAI],
        catalogIds: ["openai"]
    },
    [AiModel_Platform_Enum.MOONSHOT]: {
        kind: "llm",
        discovery: "openai",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.MOONSHOT],
        catalogIds: ["kimi-for-coding", "moonshotai", "moonshot"]
    },
    [AiModel_Platform_Enum.GEMINI]: {
        kind: "llm",
        discovery: "gemini",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.GEMINI],
        catalogIds: ["google"]
    },
    [AiModel_Platform_Enum.DEEPL]: {
        kind: "translation-engine",
        discovery: "none",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.DEEPL],
        catalogIds: []
    },
    [AiModel_Platform_Enum.DEEPLX]: {
        kind: "translation-engine",
        discovery: "none",
        generationBaseUrl:
            OFFICIAL_GENERATION_BASE_URLS[AiModel_Platform_Enum.DEEPLX],
        catalogIds: []
    }
}

export function normalizeBaseUrl(baseUrl: string): string {
    return `${baseUrl.trim().replace(/\/+$/, "")}/`
}

export function getOfficialEndpointOptions(
    provider: AiModel_Platform_Enum
): OfficialEndpointDefinition[] {
    return PROVIDER_REGISTRY[provider].officialEndpoints ?? []
}

const getSelectedOfficialEndpoint = (
    selection: ProviderEndpointSelection
): OfficialEndpointDefinition | undefined => {
    if (!selection.officialEndpointId) {
        return undefined
    }

    const endpoint = getOfficialEndpointOptions(selection.provider).find(
        option => option.id === selection.officialEndpointId
    )
    if (!endpoint) {
        throw new ProviderConfigurationError(
            `Unknown official endpoint: ${selection.officialEndpointId}`
        )
    }
    return endpoint
}

export function getGenerationBaseUrl(
    selection: ProviderEndpointSelection
): string {
    if (!selection.isOfficial) {
        if (!selection.customBaseUrl?.trim()) {
            throw new ProviderConfigurationError(
                "Custom provider requires a base URL"
            )
        }
        return normalizeBaseUrl(selection.customBaseUrl)
    }

    return (
        getSelectedOfficialEndpoint(selection)?.baseUrl ??
        PROVIDER_REGISTRY[selection.provider].generationBaseUrl
    )
}

export function isTokenPlanEndpoint(
    selection: ProviderEndpointSelection
): boolean {
    return (
        selection.isOfficial &&
        getSelectedOfficialEndpoint(selection)?.mode === "token-plan"
    )
}

export function canFallbackToCatalog(
    selection: ProviderEndpointSelection
): boolean {
    if (!selection.isOfficial) {
        return false
    }
    return getSelectedOfficialEndpoint(selection)?.catalogFallback !== "manual"
}
