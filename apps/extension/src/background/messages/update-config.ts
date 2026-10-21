import { equals, mergeDeepRight } from "ramda"

import type { ConfigUpdateRequest } from "@/messaging/protocol"
import { defaultExtensionConfig } from "@/state/constants"
import { normalizeStoredConfig } from "@/state/translationService"
import { chromeStorageAdapter } from "@/state/util"
import type { BaseModel } from "@/types"
import type { ExtensionConfig } from "@/types/config"

// All contexts share this queue in the worker. Read persistence inside the
// queue, including after a worker restart; never trust a caller's snapshot.
let pendingWrite: Promise<unknown> = Promise.resolve()

export function handleUpdateConfig(
    request: ConfigUpdateRequest
): Promise<ExtensionConfig> {
    const pending = pendingWrite
        .catch(() => undefined)
        .then(async () => {
            const stored = await chromeStorageAdapter.getItem(
                "extension-config",
                defaultExtensionConfig
            )
            const current = normalizeStoredConfig(
                stored,
                defaultExtensionConfig
            )
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
    pendingWrite = pending
    return pending
}
