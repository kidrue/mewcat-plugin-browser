import { AiModel_Platform_Enum, type BaseModel } from "@/types/aiModel"

const TRANSLATION_ONLY_PLATFORMS = new Set<AiModel_Platform_Enum>([
    AiModel_Platform_Enum.DEEPL,
    AiModel_Platform_Enum.DEEPLX
])

export const hasUsablePageSummaryModel = (models: BaseModel[]): boolean =>
    models.some(
        model =>
            model.enabled &&
            !TRANSLATION_ONLY_PLATFORMS.has(model.type) &&
            Boolean(model.params.apiKey?.trim()) &&
            Boolean(model.params.modelName?.trim())
    )
