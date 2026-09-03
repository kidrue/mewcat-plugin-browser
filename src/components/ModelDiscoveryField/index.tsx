import React, { useEffect, useMemo, useRef, useState } from "react"
import styled from "styled-components"

import type { DiscoveredModel } from "@/model-management/catalog"
import {
    discoverModels,
    ModelDiscoveryError
} from "@/model-management/discovery"
import { PROVIDER_REGISTRY } from "@/model-management/providers"
import type { BaseModel } from "@/types/aiModel"

import ApiKeyInput from "../ApiKeyInput"
import NativeSelect from "../NativeSelect"

const FieldStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
`

const FieldMeta = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 20px;
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
`

const CapabilityBadge = styled.span<{ $vision: DiscoveredModel["vision"] }>`
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-2);
    border-radius: 999px;
    color: ${props =>
        props.$vision === "supported"
            ? "var(--success)"
            : "var(--text-secondary)"};
    background: var(--bg-tertiary);
`

const RefreshButton = styled.button`
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--primary-color);
    font: inherit;
    cursor: pointer;

    &:disabled {
        color: var(--text-tertiary);
        cursor: default;
    }
`

const ErrorText = styled.div`
    color: var(--error);
    font-size: var(--font-size-xs);
`

export interface ModelSelectionOption {
    value: string
    label: string
}

export function getVisionCapabilityLabel(
    vision: DiscoveredModel["vision"]
): string {
    if (vision === "supported") {
        return "支持图片"
    }
    if (vision === "unsupported") {
        return "仅文本"
    }
    return "图片能力未知"
}

export function toModelCapabilityPatch(
    vision: DiscoveredModel["vision"]
): BaseModel["capabilities"] | undefined {
    if (vision === "supported") {
        return { vision: true }
    }
    if (vision === "unsupported") {
        return { vision: false }
    }
    return undefined
}

export function buildModelSelectionOptions(
    models: DiscoveredModel[],
    currentModelName: string
): ModelSelectionOption[] {
    const discoveredOptions = models.map(model => ({
        value: model.id,
        label: `${model.name} · ${getVisionCapabilityLabel(model.vision)}${
            model.availability === "catalog" ? " · 目录" : ""
        }`
    }))
    if (
        currentModelName.trim() &&
        !models.some(model => model.id === currentModelName)
    ) {
        return [
            {
                value: currentModelName,
                label: `${currentModelName}（当前模型未返回）`
            },
            ...discoveredOptions
        ]
    }
    return discoveredOptions
}

interface ModelDiscoveryFieldProps {
    model: BaseModel
    onChange: (
        modelName: string,
        capabilities: BaseModel["capabilities"] | undefined
    ) => void
}

export function ModelDiscoveryField({
    model,
    onChange
}: ModelDiscoveryFieldProps): React.ReactElement | null {
    const [models, setModels] = useState<DiscoveredModel[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")
    const [manualEntry, setManualEntry] = useState(false)
    const [refreshVersion, setRefreshVersion] = useState(0)
    const onChangeRef = useRef(onChange)
    const definition = PROVIDER_REGISTRY[model.type]
    const apiKey = model.params.apiKey.trim()
    const isOfficial = model.params.isOfficial !== false
    const baseUrl = model.params.baseUrl?.trim() || ""

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        setModels([])
        setErrorMessage("")
        setManualEntry(false)
        if (definition.discovery === "none" || !apiKey) {
            return
        }

        const controller = new AbortController()
        const timer = window.setTimeout(() => {
            setIsLoading(true)
            void discoverModels(
                {
                    provider: model.type,
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
                    const message =
                        error instanceof Error
                            ? error.message
                            : "无法获取模型列表"
                    setErrorMessage(message)
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
    }, [
        apiKey,
        baseUrl,
        definition.discovery,
        isOfficial,
        model.type,
        refreshVersion
    ])

    const options = useMemo(
        () => buildModelSelectionOptions(models, model.params.modelName),
        [model.params.modelName, models]
    )
    const selectedModel = models.find(
        discovered => discovered.id === model.params.modelName
    )
    const vision = selectedModel?.vision ?? "unknown"

    useEffect(() => {
        if (!selectedModel) {
            return
        }
        const capabilities = toModelCapabilityPatch(selectedModel.vision)
        if (
            capabilities &&
            model.capabilities?.vision !== capabilities.vision
        ) {
            onChangeRef.current(model.params.modelName, capabilities)
        }
    }, [model.capabilities?.vision, model.params.modelName, selectedModel])

    if (definition.discovery === "none") {
        return null
    }

    if (manualEntry) {
        return (
            <FieldStack>
                <ApiKeyInput
                    label="模型名称"
                    value={model.params.modelName}
                    disabledVisitable
                    onChange={value => onChange(value, undefined)}
                    placeholder="请输入自定义接口的模型名称"
                    helperText="该接口不支持自动获取模型列表，已切换为手动填写"
                />
                {errorMessage && (
                    <ErrorText role="alert">{errorMessage}</ErrorText>
                )}
            </FieldStack>
        )
    }

    return (
        <FieldStack>
            <NativeSelect
                id={`model-name-${model.id}`}
                aria-label="模型名称"
                value={model.params.modelName}
                options={options}
                placeholder={
                    apiKey
                        ? isLoading
                            ? "正在获取模型列表…"
                            : "请选择模型"
                        : "填写 API Key 后自动获取模型"
                }
                disabled={!apiKey || isLoading || options.length === 0}
                onChange={value => {
                    const discovered = models.find(item => item.id === value)
                    onChange(
                        value,
                        discovered
                            ? toModelCapabilityPatch(discovered.vision)
                            : undefined
                    )
                }}
            />
            <FieldMeta>
                <CapabilityBadge $vision={vision}>
                    {getVisionCapabilityLabel(vision)}
                </CapabilityBadge>
                <RefreshButton
                    type="button"
                    disabled={!apiKey || isLoading}
                    onClick={() => setRefreshVersion(version => version + 1)}
                >
                    {isLoading ? "获取中…" : "刷新模型列表"}
                </RefreshButton>
            </FieldMeta>
            {errorMessage && <ErrorText role="alert">{errorMessage}</ErrorText>}
        </FieldStack>
    )
}

export default ModelDiscoveryField
