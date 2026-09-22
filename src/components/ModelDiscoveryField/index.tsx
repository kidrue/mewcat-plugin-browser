import React, { useEffect, useMemo, useRef, useState } from "react"
import styled from "styled-components"

import { useModelDiscovery } from "@/hooks/useModelDiscovery"
import type { DiscoveredModel } from "@/model-management/catalog"
import { PROVIDER_REGISTRY } from "@/model-management/providers"
import type { BaseModel } from "@/types/aiModel"

import ApiKeyInput from "../ApiKeyInput"
import NativeSelect from "../NativeSelect"

const FieldStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
`

const SearchInput = styled.input`
    width: 100%;
    height: 36px;
    padding: 0 var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    transition: all var(--transition-fast);

    &::placeholder {
        color: var(--text-tertiary);
    }

    &:hover:not(:disabled) {
        border-color: var(--gray-400);
    }

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background: var(--gray-100);
    }
`

const EmptySearchResult = styled.div`
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
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
    currentModelName: string,
    searchQuery = ""
): ModelSelectionOption[] {
    const discoveredOptions = models.map(model => ({
        value: model.id,
        label: `${model.name} · ${getVisionCapabilityLabel(model.vision)}${
            model.availability === "catalog" ? " · 目录" : ""
        }`
    }))
    const options =
        currentModelName.trim() &&
        !models.some(model => model.id === currentModelName)
            ? [
                  {
                      value: currentModelName,
                      label: `${currentModelName}（当前模型未返回）`
                  },
                  ...discoveredOptions
              ]
            : discoveredOptions
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
    if (!normalizedQuery) {
        return options
    }
    return options.filter(option =>
        `${option.value} ${option.label}`
            .toLocaleLowerCase()
            .includes(normalizedQuery)
    )
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
    const onChangeRef = useRef(onChange)
    const definition = PROVIDER_REGISTRY[model.type]
    const { models, isLoading, errorMessage, manualEntry, refresh } =
        useModelDiscovery(model)
    const apiKey = model.params.apiKey.trim()
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    const options = useMemo(
        () =>
            buildModelSelectionOptions(
                models,
                model.params.modelName,
                searchQuery
            ),
        [model.params.modelName, models, searchQuery]
    )
    const selectedModel = models.find(
        discovered => discovered.id === model.params.modelName
    )
    const vision = selectedModel?.vision ?? "unknown"

    useEffect(() => {
        setSearchQuery("")
    }, [model.id])

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
            <FieldStack id={`model-field-${model.id}`} tabIndex={-1}>
                <ApiKeyInput
                    id={`model-name-${model.id}`}
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
        <FieldStack id={`model-field-${model.id}`} tabIndex={-1}>
            {models.length > 0 && (
                <SearchInput
                    type="search"
                    aria-label="搜索可用模型"
                    value={searchQuery}
                    disabled={isLoading}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder="搜索可用模型"
                />
            )}
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
            {searchQuery.trim() && options.length === 0 && (
                <EmptySearchResult role="status">
                    未找到匹配的模型
                </EmptySearchResult>
            )}
            <FieldMeta>
                <CapabilityBadge $vision={vision}>
                    {getVisionCapabilityLabel(vision)}
                </CapabilityBadge>
                <RefreshButton
                    type="button"
                    disabled={!apiKey || isLoading}
                    onClick={refresh}
                >
                    {isLoading ? "获取中…" : "刷新模型列表"}
                </RefreshButton>
            </FieldMeta>
            {errorMessage && <ErrorText role="alert">{errorMessage}</ErrorText>}
        </FieldStack>
    )
}

export default ModelDiscoveryField
