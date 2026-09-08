import { platformNameMap } from "../constants/translationServices"
import type { DiscoveredModel } from "../model-management/catalog"
import { PROVIDER_REGISTRY } from "../model-management/providers"
import type { AiModel_Platform_Enum, BaseModel } from "../types/aiModel"
import type { ExtensionConfig } from "../types/config"

export interface VisionPlatformOption {
    label: string
    value: AiModel_Platform_Enum
}

export interface VisionModelOption {
    label: string
    value: string
}

export interface ModelSelectionOption {
    label: string
    value: string
}

export interface VisionServiceOption {
    value: string
    label: string
    service: BaseModel
}

export interface ImageTranslationEnableConfig {
    enableImageTranslateButton?: boolean
    imageTranslationModelId?: string
    aiModelList?: BaseModel[]
}

export function isVisionCapableModel(
    model: BaseModel | undefined | null
): boolean {
    return model?.capabilities?.vision === true
}

export function normalizeImageTranslationSelection(
    config: ExtensionConfig
): ExtensionConfig {
    const imageTranslationModelId = config.imageTranslationModelId?.trim()
    const service = config.aiModelList.find(
        model => model.id === imageTranslationModelId
    )
    const isUsableService =
        service?.enabled === true &&
        service.params.apiKey.trim() !== "" &&
        PROVIDER_REGISTRY[service.type]?.kind === "llm"

    if (!service || !isUsableService) {
        return {
            ...config,
            enableImageTranslateButton: false,
            imageTranslationModelId: "",
            imageTranslationModelName: ""
        }
    }

    return {
        ...config,
        imageTranslationModelId,
        imageTranslationModelName:
            config.imageTranslationModelName?.trim() ||
            service.params.modelName.trim()
    }
}

const isUsableVisionModel = (model: BaseModel): boolean =>
    model.enabled &&
    model.params.apiKey.trim().length > 0 &&
    isVisionCapableModel(model)

const isUsableVisionService = (model: BaseModel): boolean =>
    model.enabled &&
    model.params.apiKey.trim().length > 0 &&
    PROVIDER_REGISTRY[model.type]?.kind === "llm"

export function buildVisionServiceLabel(
    model: BaseModel,
    duplicateIndex?: number
): string {
    const modelName = model.params.modelName.trim() || "未配置模型"
    const source = model.params.isOfficial === false ? "自定义" : "官方"
    const duplicateSuffix =
        duplicateIndex && duplicateIndex > 1 ? `（${duplicateIndex}）` : ""

    return `${platformNameMap[model.type]} · ${modelName} · ${source}${duplicateSuffix}`
}

export function getVisionServiceOptions(
    models: BaseModel[]
): VisionServiceOption[] {
    const labelCounts = new Map<string, number>()

    return models.filter(isUsableVisionService).map(service => {
        const label = buildVisionServiceLabel(service)
        const duplicateIndex = (labelCounts.get(label) ?? 0) + 1
        labelCounts.set(label, duplicateIndex)

        return {
            value: service.id,
            label: buildVisionServiceLabel(service, duplicateIndex),
            service
        }
    })
}

const getDiscoveredModelLabel = (model: DiscoveredModel): string => {
    const name =
        model.name === model.id ? model.name : `${model.name} · ${model.id}`
    const capability =
        model.vision === "supported" ? "支持图片" : "图片能力未知"
    const catalog = model.availability === "catalog" ? " · 目录" : ""

    return `${name} · ${capability}${catalog}`
}

const getRemoteVisionModelOptions = (
    models: DiscoveredModel[]
): ModelSelectionOption[] =>
    models
        .filter(model => model.vision !== "unsupported")
        .map(model => ({
            value: model.id,
            label: getDiscoveredModelLabel(model)
        }))

const getConfiguredVisionModelOptions = (
    models: BaseModel[],
    platform?: AiModel_Platform_Enum
): VisionModelOption[] =>
    models
        .filter(
            model =>
                isUsableVisionModel(model) &&
                (!platform || model.type === platform)
        )
        .map(model => ({
            label: model.name,
            value: model.id
        }))

export function getVisionModelOptions(
    models: DiscoveredModel[]
): ModelSelectionOption[]
export function getVisionModelOptions(
    models: BaseModel[],
    platform?: AiModel_Platform_Enum
): VisionModelOption[]
export function getVisionModelOptions(
    models: DiscoveredModel[] | BaseModel[],
    platform?: AiModel_Platform_Enum
): ModelSelectionOption[] | VisionModelOption[] {
    if (models.length === 0 || "availability" in models[0]) {
        return getRemoteVisionModelOptions(
            models as unknown as DiscoveredModel[]
        )
    }

    return getConfiguredVisionModelOptions(models as BaseModel[], platform)
}

export function buildVisionModelSelectionOptions(
    models: DiscoveredModel[],
    currentModelName: string | undefined
): ModelSelectionOption[] {
    const options = getRemoteVisionModelOptions(models)
    const selectedModelName = currentModelName?.trim()

    if (
        selectedModelName &&
        !options.some(option => option.value === selectedModelName)
    ) {
        return [
            {
                value: selectedModelName,
                label: `${selectedModelName}（当前模型未返回）`
            },
            ...options
        ]
    }

    return options
}

export function getVisionPlatformOptions(
    models: BaseModel[]
): VisionPlatformOption[] {
    const platforms = new Set<AiModel_Platform_Enum>()

    return models.filter(isUsableVisionModel).flatMap(model => {
        if (platforms.has(model.type)) {
            return []
        }

        platforms.add(model.type)
        return [{ label: platformNameMap[model.type], value: model.type }]
    })
}

export function getVisionPlatformSelection(
    selectedModelId: string | undefined,
    models: BaseModel[]
): AiModel_Platform_Enum | "" {
    return (
        models.find(
            model => model.id === selectedModelId && isUsableVisionModel(model)
        )?.type ?? ""
    )
}

export function isImageTranslationEnabled({
    enableImageTranslateButton,
    imageTranslationModelId,
    aiModelList = []
}: ImageTranslationEnableConfig): boolean {
    if (!enableImageTranslateButton || !imageTranslationModelId?.trim()) {
        return false
    }

    return getConfiguredVisionModelOptions(aiModelList).some(
        option => option.value === imageTranslationModelId
    )
}

export function getImageTranslationConfigRepair(
    config: ImageTranslationEnableConfig
): { enableImageTranslateButton: false } | null {
    return config.enableImageTranslateButton &&
        !isImageTranslationEnabled(config)
        ? { enableImageTranslateButton: false }
        : null
}

export function normalizeImageTranslationModelSelection(
    selectedModelId: string | undefined,
    models: BaseModel[]
): string {
    const options = getConfiguredVisionModelOptions(models)
    return options.some(option => option.value === selectedModelId)
        ? selectedModelId!
        : (options[0]?.value ?? "")
}
