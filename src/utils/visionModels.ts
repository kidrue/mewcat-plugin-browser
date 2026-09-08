import { platformNameMap } from "../constants/translationServices"
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

export function getVisionModelOptions(
    models: BaseModel[],
    platform?: AiModel_Platform_Enum
): VisionModelOption[] {
    return models
        .filter(
            model =>
                isUsableVisionModel(model) &&
                (!platform || model.type === platform)
        )
        .map(model => ({
            label: model.name,
            value: model.id
        }))
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

    return getVisionModelOptions(aiModelList).some(
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
    const options = getVisionModelOptions(models)
    return options.some(option => option.value === selectedModelId)
        ? selectedModelId!
        : (options[0]?.value ?? "")
}
