import {
    isConfiguredGenerativeModel,
    type TranslationRuntimeConfig
} from "@/translation/translationService"
import type { BaseModel } from "@/types/aiModel"

export const hasUsablePageSummaryModel = (models: BaseModel[]): boolean =>
    models.some(isConfiguredGenerativeModel)

export const selectPageSummaryModel = (
    config: Pick<TranslationRuntimeConfig, "currentModel" | "aiModelList">
): BaseModel | null => {
    const selected = config.aiModelList.find(
        model => model.id === config.currentModel
    )
    if (selected && isConfiguredGenerativeModel(selected)) {
        return selected
    }
    return config.aiModelList.find(isConfiguredGenerativeModel) ?? null
}
