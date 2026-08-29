import { AiModel_Platform_Enum } from "@/types/aiModel"

export type ProviderKind = "llm" | "translation-engine"
export type ModelDiscoveryStrategy = "openai" | "gemini" | "none"

export interface ProviderDefinition {
    kind: ProviderKind
    discovery: ModelDiscoveryStrategy
    generationBaseUrl: string
    catalogIds: string[]
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
        catalogIds: ["alibaba"]
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

export function getGenerationBaseUrl(
    provider: AiModel_Platform_Enum,
    isOfficial: boolean,
    customBaseUrl?: string
): string {
    if (!isOfficial && customBaseUrl?.trim()) {
        return normalizeBaseUrl(customBaseUrl)
    }
    return PROVIDER_REGISTRY[provider].generationBaseUrl
}
