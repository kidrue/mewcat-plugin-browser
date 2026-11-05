import { equals, mergeDeepRight } from "ramda"

import { storage } from "#imports"

import { STORAGE_NAMES, toWxtSyncStorageKey } from "@/constants/storage"
import type { ConfigUpdateRequest } from "@/messaging/protocol"
import { defaultExtensionConfig } from "@/state/constants"
import { normalizeStoredConfig } from "@/state/translationService"
import { chromeStorageAdapter } from "@/state/util"
import type { BaseModel } from "@/types"
import type { ExtensionConfig } from "@/types/config"

// All contexts share this queue in the worker. Read persistence inside the
// queue, including after a worker restart; never trust a caller's snapshot.
let pendingWrite: Promise<unknown> = Promise.resolve()

function enqueueConfigWrite(
    operation: () => Promise<ExtensionConfig>
): Promise<ExtensionConfig> {
    const pending = pendingWrite.catch(() => undefined).then(operation)
    pendingWrite = pending
    return pending
}

async function readConfig() {
    const stored = await chromeStorageAdapter.getItem(
        "extension-config",
        defaultExtensionConfig
    )
    return {
        stored,
        current: normalizeStoredConfig(stored, defaultExtensionConfig)
    }
}

export function handleUpdateConfig(
    request: ConfigUpdateRequest
): Promise<ExtensionConfig> {
    return enqueueConfigWrite(async () => {
        const { stored, current } = await readConfig()
        const updated =
            request.type === "patch"
                ? mergeDeepRight(current, request.updates)
                : {
                      ...current,
                      aiModelList: current.aiModelList.map(model =>
                          model.id === request.updates.id
                              ? (mergeDeepRight(
                                    model,
                                    request.updates
                                ) as BaseModel)
                              : model
                      )
                  }
        const next = normalizeStoredConfig(updated, defaultExtensionConfig)
        if (!equals(stored, next)) {
            await chromeStorageAdapter.setItem("extension-config", next)
        }
        return next
    })
}

export function migrateRequestConcurrency(): Promise<ExtensionConfig> {
    return enqueueConfigWrite(async () => {
        const migrationKey = toWxtSyncStorageKey(
            STORAGE_NAMES.requestConcurrencyMigration
        )
        const version = await storage.getItem<number>(migrationKey)
        const { current } = await readConfig()
        if (
            typeof version === "number" &&
            Number.isFinite(version) &&
            version >= 1
        )
            return current
        // Keep this one-time target independent of defaults in future releases.
        const next = { ...current, maxRequestsPerSecond: 8 }
        // Both keys use sync storage, so WXT persists them in one storage.sync.set.
        // A separate key survives configuration writes from older clients.
        await storage.setItems([
            {
                key: toWxtSyncStorageKey(STORAGE_NAMES.extensionConfig),
                value: next
            },
            { key: migrationKey, value: 1 }
        ])
        return next
    })
}
