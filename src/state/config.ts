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

// Serialize read-modify-write operations per store, including persistence.
const configWriteQueueAtom = atom<Promise<unknown>>(Promise.resolve())
const mutateConfigAtom = atom(
    null,
    (get, set, update: (config: ExtensionConfig) => ExtensionConfig) => {
        const pending = get(configWriteQueueAtom)
            .catch(() => undefined)
            .then(async () => {
                const current = await get(configAtom)
                const next = update(current)
                if (!equals(current, next)) {
                    await set(configAtom, next)
                }
                return next
            })
        set(configWriteQueueAtom, pending)
        return pending
    }
)

export const updateConfigAtom = atom(
    null,
    (_get, set, updates: DeepPartial<ExtensionConfig>) =>
        set(
            mutateConfigAtom,
            current =>
                mergeDeepRight(clone(current), updates) as ExtensionConfig
        )
)

// 添加一个修改ai模型配置的原子方法
export const updateAiModelConfigAtom = atom(
    null,
    async (
        _get,
        set,
        updates: { id: string } & DeepPartial<BaseModel>
    ): Promise<ExtensionConfig> => {
        return set(mutateConfigAtom, currentConfig => {
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
            return { ...currentConfig, aiModelList: newAiModelList }
        })
    }
)

export const useConfig = () => {
    return useAtomValue(configAtom)
}
