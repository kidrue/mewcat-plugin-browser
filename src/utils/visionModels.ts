import type { BaseModel } from "../types/aiModel"

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

const isUsableVisionModel = (model: BaseModel): boolean =>
    model.enabled &&
    model.params.apiKey.trim().length > 0 &&
    isVisionCapableModel(model)

export function getVisionModelOptions(
    models: BaseModel[]
): VisionModelOption[] {
    return models.filter(isUsableVisionModel).map(model => ({
        label: model.name,
        value: model.id
    }))
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
