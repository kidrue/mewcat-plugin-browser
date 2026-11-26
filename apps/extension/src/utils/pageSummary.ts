import { MEWCAT_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import {
    getSelectedGenerativeModel,
    type TranslationRuntimeConfig
} from "@/features/translation/translationService"
import type { BaseModel } from "@/types/aiModel"

export const PAGE_SUMMARY_UNAVAILABLE_MESSAGE =
    "没有对应的翻译服务支持页面总结。"

export const isTranslationContextAvailable = (
    config: Pick<TranslationRuntimeConfig, "currentModel" | "aiModelList">
): boolean =>
    config.currentModel === MEWCAT_TRANSLATE_MODEL_ID ||
    Boolean(getSelectedGenerativeModel(config))

export const isPageSummaryAvailable = isTranslationContextAvailable

export const selectPageSummaryModel = (
    config: Pick<TranslationRuntimeConfig, "currentModel" | "aiModelList">
): BaseModel | null => getSelectedGenerativeModel(config) ?? null
