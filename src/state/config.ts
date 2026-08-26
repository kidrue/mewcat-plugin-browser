import { atom, useAtomValue } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { clone, equals, findIndex, mergeDeepRight } from "ramda"

import type { BaseModel } from "@/types"
import { type DeepPartial, type ExtensionConfig } from "@/types/config"

import { defaultExtensionConfig } from "./constants"
import { createTranslationServiceStorageAdapter } from "./translationService"
import { chromeStorageAdapter } from "./util"

// import { chromeStorageAdapter } from "./util"

const configStorageAdapter =
    createTranslationServiceStorageAdapter(chromeStorageAdapter)

// 配置原子
export const configAtom = atomWithStorage<ExtensionConfig>(
    "extension-config",
    defaultExtensionConfig,
    configStorageAdapter,
    {
        getOnInit: true
    }
)

export const extensionConfigAtom = atom(async get => {
    return get(configAtom)
})

export const updateConfigAtom = atom(
    null,
    async (get, set, updates: DeepPartial<ExtensionConfig>) => {
        const currentConfig = await get(configAtom)
        const newConfig = mergeDeepRight(
            clone(currentConfig),
            updates
        ) as ExtensionConfig
        if (equals(newConfig, currentConfig)) {
            return currentConfig
        }
        set(configAtom, newConfig)

        return newConfig
    }
)

// 添加一个修改ai模型配置的原子方法
export const updateAiModelConfigAtom = atom(
    null,
    async (
        get,
        set,
        updates: { id: string } & DeepPartial<BaseModel>
    ): Promise<ExtensionConfig> => {
        const currentConfig = await clone(get(configAtom))
        const aiModelList = currentConfig.aiModelList
        const aiModelIndex = findIndex(
            model => model.id === updates.id,
            aiModelList
        )
        if (aiModelIndex === -1) {
            return currentConfig
        }
        const updatedModel = mergeDeepRight(
            clone(aiModelList[aiModelIndex]),
            updates
        )
        const newAiModelList = aiModelList.map((model, index) =>
            index === aiModelIndex ? updatedModel : model
        )
        set(configAtom, { ...currentConfig, aiModelList: newAiModelList })
        return { ...currentConfig, aiModelList }
    }
)

export const useConfig = () => {
    return useAtomValue(configAtom)
}
