import {
    GOOGLE_TRANSLATE_MODEL_ID,
    MICROSOFT_TRANSLATE_MODEL_ID
} from "@/constants/translationServices"
import { migrateLegacyModel } from "@/model-management/catalog"
import type { BaseModel } from "@/types"
import type { ExtensionConfig } from "@/types/config"
import { repairExtensionConfig } from "@/types/extensionConfigSchema"
import { normalizeImageTranslationSelection } from "@/utils/visionModels"

import { defaultExtensionConfig } from "./constants"

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
    if (
        config.currentModel === GOOGLE_TRANSLATE_MODEL_ID ||
        config.currentModel === MICROSOFT_TRANSLATE_MODEL_ID
    ) {
        return config.currentModel
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

export function migrateTranslationServiceModels<
    T extends TranslationServiceSelectionConfig
>(config: T): T {
    const aiModelList = config.aiModelList.map(migrateLegacyModel)
    return aiModelList.every(
        (model, index) => model === config.aiModelList[index]
    )
        ? config
        : ({ ...config, aiModelList } as T)
}

export const normalizeStoredConfig = (
    config: unknown,
    defaults: ExtensionConfig
): ExtensionConfig =>
    normalizeImageTranslationSelection(
        normalizeTranslationServiceSelection(
            migrateTranslationServiceModels(
                repairExtensionConfig(config, defaults)
            )
        )
    )

export function createTranslationServiceStorageAdapter(
    storageAdapter: TranslationServiceStorageAdapter
): TranslationServiceStorageAdapter {
    return {
        async getItem(key, initialValue) {
            const storedConfig = await storageAdapter.getItem(key, initialValue)
            // Readers must not persist snapshots that may already be stale.
            return normalizeStoredConfig(storedConfig, initialValue)
        },
        setItem(key, value) {
            return storageAdapter.setItem(
                key,
                normalizeStoredConfig(value, defaultExtensionConfig)
            )
        },
        removeItem(key) {
            return storageAdapter.removeItem(key)
        },
        subscribe(key, callback, initialValue) {
            return storageAdapter.subscribe(
                key,
                value => {
                    const normalizedConfig = normalizeStoredConfig(
                        value,
                        initialValue
                    )
                    callback(normalizedConfig)
                },
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
        { value: MICROSOFT_TRANSLATE_MODEL_ID, label: "微软翻译（免费）" },
        ...aiModelList.filter(isUsableModel).map(model => ({
            value: model.id,
            label: model.name || "未命名模型"
        }))
    ]
}
