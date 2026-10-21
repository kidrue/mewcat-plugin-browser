import { atom, useAtomValue } from "jotai"

import { sendMessage } from "@/messaging"
import type { ConfigUpdateRequest } from "@/messaging/protocol"
import type { BaseModel } from "@/types"
import { type DeepPartial, type ExtensionConfig } from "@/types/config"

import { defaultExtensionConfig } from "./constants"
import { createTranslationServiceStorageAdapter } from "./translationService"
import { chromeStorageAdapter } from "./util"

const configStorageAdapter =
    createTranslationServiceStorageAdapter(chromeStorageAdapter)
const readConfig = () =>
    configStorageAdapter.getItem("extension-config", defaultExtensionConfig)

// This atom is only a local view. Persistence always goes through the worker.
const configValueAtom = atom<ExtensionConfig | Promise<ExtensionConfig>>(
    readConfig()
)
configValueAtom.onMount = setValue => {
    let active = true
    const unsubscribe = configStorageAdapter.subscribe(
        "extension-config",
        value => {
            setValue(value)
        },
        defaultExtensionConfig
    )
    // Refresh after being unmounted; ignore reads overtaken by a storage event.
    const refreshed = readConfig()
    setValue(refreshed)
    void refreshed.then(
        value => {
            if (active) {
                setValue(current => (current === refreshed ? value : current))
            }
        },
        () => undefined
    )
    return () => {
        active = false
        unsubscribe()
    }
}

export const configAtom = atom(get => get(configValueAtom))
export const extensionConfigAtom = atom(async get => get(configAtom))

// Preserve submission/response order within each store. Cross-context writes
// are serialized separately by the worker, never from this cache.
const configWriteQueueAtom = atom<Promise<unknown>>(Promise.resolve())
const mutateConfigAtom = atom(
    null,
    (get, set, request: ConfigUpdateRequest) => {
        const pending = get(configWriteQueueAtom)
            .catch(() => undefined)
            .then(async () => {
                const before = get(configValueAtom)
                const next = await sendMessage("update-config", request)
                // A newer storage event may arrive before this reply. Mounted
                // readers receive saves through the subscription as well.
                if (get(configValueAtom) === before) {
                    set(configValueAtom, next)
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
        set(mutateConfigAtom, { type: "patch", updates })
)

export const updateAiModelConfigAtom = atom(
    null,
    (_get, set, updates: { id: string } & DeepPartial<BaseModel>) =>
        set(mutateConfigAtom, { type: "model", updates })
)

export const useConfig = () => useAtomValue(configAtom)
