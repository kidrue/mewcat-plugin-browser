import { listModels } from "@xsai/model"

import { STORAGE_NAMES } from "@/constants/storage"
import type { AiModel_Platform_Enum } from "@/types/aiModel"

import {
    mergeDiscoveredModels,
    type CatalogModel,
    type DiscoveredModel,
    type RemoteModel
} from "./catalog"
import { getGenerationBaseUrl, PROVIDER_REGISTRY } from "./providers"

export interface ProviderConnection {
    provider: AiModel_Platform_Enum
    apiKey: string
    isOfficial: boolean
    baseUrl?: string
}

export type ModelDiscoveryErrorCode =
    | "AUTHENTICATION_FAILED"
    | "DISCOVERY_UNSUPPORTED"
    | "NETWORK_FAILURE"

export class ModelDiscoveryError extends Error {
    readonly code: ModelDiscoveryErrorCode

    constructor(code: ModelDiscoveryErrorCode, message: string) {
        super(message)
        this.name = "ModelDiscoveryError"
        this.code = code
    }
}

interface ModelsDevProvider {
    models?: Record<string, unknown>
}

interface ModelsDevModel {
    name?: unknown
    modalities?: {
        input?: unknown
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

export function extractModelsDevCatalog(
    response: unknown,
    providerIds: string[]
): CatalogModel[] {
    if (!isRecord(response)) {
        return []
    }

    return providerIds.flatMap(providerId => {
        const provider = response[providerId] as ModelsDevProvider | undefined
        if (!isRecord(provider) || !isRecord(provider.models)) {
            return []
        }

        return Object.entries(provider.models).flatMap(([id, value]) => {
            if (!isRecord(value)) {
                return []
            }
            const model = value as ModelsDevModel
            const input = model.modalities?.input
            return [
                {
                    id,
                    name: typeof model.name === "string" ? model.name : id,
                    modalities: Array.isArray(input)
                        ? {
                              input: input.filter(
                                  (item): item is string =>
                                      typeof item === "string"
                              )
                          }
                        : undefined
                }
            ]
        })
    })
}

interface GeminiModelResource {
    name?: unknown
    displayName?: unknown
    supportedGenerationMethods?: unknown
}

export function parseGeminiModelResponse(response: unknown): RemoteModel[] {
    if (!isRecord(response) || !Array.isArray(response.models)) {
        return []
    }

    return response.models.flatMap(value => {
        if (!isRecord(value)) {
            return []
        }
        const model = value as GeminiModelResource
        if (
            typeof model.name !== "string" ||
            !Array.isArray(model.supportedGenerationMethods) ||
            !model.supportedGenerationMethods.includes("generateContent")
        ) {
            return []
        }
        return [
            {
                id: model.name.replace(/^models\//, ""),
                name:
                    typeof model.displayName === "string"
                        ? model.displayName
                        : model.name.replace(/^models\//, "")
            }
        ]
    })
}

const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CATALOG_CACHE_KEY_PREFIX = STORAGE_NAMES.modelCatalogCachePrefix

interface CatalogCacheEntry {
    fetchedAt: number
    models: CatalogModel[]
}

const memoryCatalogCache = new Map<string, CatalogCacheEntry>()

const readStoredCatalog = async (
    key: string
): Promise<CatalogCacheEntry | undefined> => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
        return undefined
    }
    const result = await chrome.storage.local.get(key)
    const entry = result[key]
    if (!isRecord(entry) || !Array.isArray(entry.models)) {
        return undefined
    }
    return entry as unknown as CatalogCacheEntry
}

const writeStoredCatalog = async (
    key: string,
    entry: CatalogCacheEntry
): Promise<void> => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
        return
    }
    await chrome.storage.local.set({ [key]: entry })
}

async function loadModelsDevCatalog(
    provider: AiModel_Platform_Enum,
    fetchImpl: typeof fetch = fetch
): Promise<CatalogModel[]> {
    const key = `${CATALOG_CACHE_KEY_PREFIX}${provider}`
    const now = Date.now()
    const cached = memoryCatalogCache.get(key) ?? (await readStoredCatalog(key))
    if (cached && now - cached.fetchedAt < CATALOG_CACHE_TTL_MS) {
        memoryCatalogCache.set(key, cached)
        return cached.models
    }

    const response = await fetchImpl("https://models.dev/api.json")
    if (!response.ok) {
        throw new ModelDiscoveryError("NETWORK_FAILURE", "无法加载公共模型目录")
    }
    const models = extractModelsDevCatalog(
        await response.json(),
        PROVIDER_REGISTRY[provider].catalogIds
    )
    const entry = { fetchedAt: now, models }
    memoryCatalogCache.set(key, entry)
    await writeStoredCatalog(key, entry)
    return models
}

type ListOpenAiModels = (options: {
    apiKey: string
    baseURL: string
    abortSignal?: AbortSignal
}) => Promise<RemoteModel[]>

export interface DiscoveryDependencies {
    listOpenAiModels?: ListOpenAiModels
    loadCatalog?: () => Promise<CatalogModel[]>
    fetchImpl?: typeof fetch
}

const listGeminiModels = async (
    apiKey: string,
    signal: AbortSignal | undefined,
    fetchImpl: typeof fetch
): Promise<RemoteModel[]> => {
    const response = await fetchImpl(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
        {
            headers: { "x-goog-api-key": apiKey },
            signal
        }
    )
    if (!response.ok) {
        throw new ModelDiscoveryError(
            response.status === 401 || response.status === 403
                ? "AUTHENTICATION_FAILED"
                : "NETWORK_FAILURE",
            response.status === 401 || response.status === 403
                ? "API Key 无效或没有模型访问权限"
                : "无法获取 Gemini 模型列表"
        )
    }
    return parseGeminiModelResponse(await response.json())
}

export async function discoverModels(
    connection: ProviderConnection,
    dependencies: DiscoveryDependencies = {},
    signal?: AbortSignal
): Promise<DiscoveredModel[]> {
    const definition = PROVIDER_REGISTRY[connection.provider]
    if (definition.discovery === "none") {
        return []
    }

    const fetchImpl = dependencies.fetchImpl ?? fetch
    const loadCatalog =
        dependencies.loadCatalog ??
        (() => loadModelsDevCatalog(connection.provider, fetchImpl))
    const catalogPromise = loadCatalog().catch(() => [] as CatalogModel[])

    try {
        const remoteModels =
            definition.discovery === "gemini" && connection.isOfficial
                ? await listGeminiModels(connection.apiKey, signal, fetchImpl)
                : await (dependencies.listOpenAiModels ?? listModels)({
                      apiKey: connection.apiKey,
                      baseURL: getGenerationBaseUrl(
                          connection.provider,
                          connection.isOfficial,
                          connection.baseUrl
                      ),
                      abortSignal: signal
                  })
        return mergeDiscoveredModels(remoteModels, await catalogPromise)
    } catch (error) {
        if (!connection.isOfficial) {
            throw new ModelDiscoveryError(
                "DISCOVERY_UNSUPPORTED",
                "当前自定义接口不支持自动获取模型列表"
            )
        }
        const catalog = await catalogPromise
        if (catalog.length > 0) {
            return mergeDiscoveredModels(null, catalog)
        }
        if (error instanceof ModelDiscoveryError) {
            throw error
        }
        throw new ModelDiscoveryError(
            "NETWORK_FAILURE",
            "无法获取模型列表，请检查 API Key 和网络连接"
        )
    }
}
