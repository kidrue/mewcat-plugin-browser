import { useCallback, useEffect, useState } from "react"

import type { DiscoveredModel } from "@/model-management/catalog"
import {
    discoverModels,
    ModelDiscoveryError
} from "@/model-management/discovery"
import { PROVIDER_REGISTRY } from "@/model-management/providers"
import type { BaseModel } from "@/types/aiModel"

export interface ModelDiscoveryState {
    models: DiscoveredModel[]
    isLoading: boolean
    errorMessage: string
    manualEntry: boolean
    refresh: () => void
}

export function useModelDiscovery(
    model: BaseModel | undefined
): ModelDiscoveryState {
    const [models, setModels] = useState<DiscoveredModel[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")
    const [manualEntry, setManualEntry] = useState(false)
    const [refreshVersion, setRefreshVersion] = useState(0)
    const provider = model?.type
    const definition = provider ? PROVIDER_REGISTRY[provider] : undefined
    const apiKey = model?.params.apiKey.trim() ?? ""
    const isOfficial = model?.params.isOfficial !== false
    const baseUrl = model?.params.baseUrl?.trim() || ""

    useEffect(() => {
        setModels([])
        setIsLoading(false)
        setErrorMessage("")
        setManualEntry(false)

        if (
            !provider ||
            !definition ||
            definition.discovery === "none" ||
            !apiKey
        ) {
            return
        }

        const controller = new AbortController()
        const timer = window.setTimeout(() => {
            setIsLoading(true)
            void discoverModels(
                {
                    provider,
                    apiKey,
                    isOfficial,
                    baseUrl
                },
                {},
                controller.signal
            )
                .then(discovered => {
                    if (!controller.signal.aborted) {
                        setModels(discovered)
                    }
                })
                .catch(error => {
                    if (controller.signal.aborted) {
                        return
                    }
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : "无法获取模型列表"
                    )
                    if (
                        !isOfficial &&
                        error instanceof ModelDiscoveryError &&
                        error.code === "DISCOVERY_UNSUPPORTED"
                    ) {
                        setManualEntry(true)
                    }
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setIsLoading(false)
                    }
                })
        }, 400)

        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [apiKey, baseUrl, definition, isOfficial, provider, refreshVersion])

    const refresh = useCallback(() => {
        setRefreshVersion(version => version + 1)
    }, [])

    return { models, isLoading, errorMessage, manualEntry, refresh }
}
