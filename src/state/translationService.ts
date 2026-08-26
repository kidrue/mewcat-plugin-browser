import { GOOGLE_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import type { BaseModel } from "@/types"
import type { ExtensionConfig } from "@/types/config"

export interface TranslationServiceSelectionConfig {
    currentModel?: string
    aiModelList: BaseModel[]
}

export interface TranslationServiceOption {
    value: string
    label: string
}

export interface TranslationServiceStorageAdapter {
    getItem(
        key: string,
        initialValue: ExtensionConfig
    ): Promise<ExtensionConfig>
    setItem(key: string, value: ExtensionConfig): Promise<void>
    removeItem(key: string): Promise<void>
    subscribe(
        key: string,
        callback: (value: ExtensionConfig) => void,
        initialValue: ExtensionConfig
    ): () => void
}

const isUsableModel = (model: BaseModel): boolean =>
    model.enabled && Boolean(model.params.apiKey?.trim())

export function resolveTranslationServiceId(
    config: TranslationServiceSelectionConfig
): string {
    if (config.currentModel === GOOGLE_TRANSLATE_MODEL_ID) {
        return GOOGLE_TRANSLATE_MODEL_ID
    }

    const currentModel = config.aiModelList.find(
        model => model.id === config.currentModel
    )
    if (currentModel && isUsableModel(currentModel)) {
        return currentModel.id
    }

    return (
        config.aiModelList.find(isUsableModel)?.id ?? GOOGLE_TRANSLATE_MODEL_ID
    )
}

export function normalizeTranslationServiceSelection<
    T extends TranslationServiceSelectionConfig
>(config: T): T & { currentModel: string } {
    const currentModel = resolveTranslationServiceId(config)
    if (currentModel === config.currentModel) {
        return config as T & { currentModel: string }
    }

    return { ...config, currentModel }
}

export function createTranslationServiceStorageAdapter(
    storageAdapter: TranslationServiceStorageAdapter
): TranslationServiceStorageAdapter {
    return {
        async getItem(key, initialValue) {
            const storedConfig = await storageAdapter.getItem(key, initialValue)
            const normalizedConfig =
                normalizeTranslationServiceSelection(storedConfig)

            if (normalizedConfig.currentModel !== storedConfig.currentModel) {
                await storageAdapter.setItem(key, normalizedConfig)
            }

            return normalizedConfig
        },
        setItem(key, value) {
            return storageAdapter.setItem(key, value)
        },
        removeItem(key) {
            return storageAdapter.removeItem(key)
        },
        subscribe(key, callback, initialValue) {
            return storageAdapter.subscribe(
                key,
                value => callback(normalizeTranslationServiceSelection(value)),
                initialValue
            )
        }
    }
}

export function getTranslationServiceOptions(
    aiModelList: BaseModel[]
): TranslationServiceOption[] {
    return [
        {
            value: GOOGLE_TRANSLATE_MODEL_ID,
            label: "Google Translate"
        },
        ...aiModelList.filter(isUsableModel).map(model => ({
            value: model.id,
            label: model.name || "未命名模型"
        }))
    ]
}
