import { AiModel_Platform_Enum, type BaseModel } from "../types/aiModel"

export interface VisionModelOption {
    label: string
    value: string
}

export interface ImageTranslationEnableConfig {
    enableImageTranslateButton?: boolean
    imageTranslationModelId?: string
    aiModelList?: BaseModel[]
}

const officialOpenAiVisionModelNames = new Set([
    "gpt-5",
    "gpt-5-chat",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5.2-2025-12-11"
])

export function isVisionCapableModel(
    model: BaseModel | undefined | null
): boolean {
    if (!model) {
        return false
    }

    if (typeof model.capabilities?.vision === "boolean") {
        return model.capabilities.vision
    }

    if (model.type === AiModel_Platform_Enum.GEMINI) {
        return true
    }

    if (
        model.type === AiModel_Platform_Enum.OPENAI &&
        model.params.isOfficial === true &&
        officialOpenAiVisionModelNames.has(model.params.modelName)
    ) {
        return true
    }

    if (
        model.type === AiModel_Platform_Enum.ZHIPU &&
        model.params.modelName.toLowerCase().includes("glm-4v")
    ) {
        return true
    }

    return (
        (model.type === AiModel_Platform_Enum.HUOSHAN ||
            model.type === AiModel_Platform_Enum.BAILIAN) &&
        model.params.modelName.toLowerCase().includes("vision")
    )
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
