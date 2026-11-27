import React, { useEffect, useMemo, useRef, useState } from "react"

import { PROVIDER_REGISTRY } from "@/features/model-management"
import { useModelDiscovery } from "@/hooks/useModelDiscovery"

import ApiKeyInput from "../ApiKeyInput"
import Select from "../Select"
import {
    CapabilityBadge,
    ErrorText,
    FieldMeta,
    FieldStack,
    RefreshButton
} from "./styles"
import type { ModelDiscoveryFieldProps } from "./types"
import {
    buildModelSelectionOptions,
    getVisionCapabilityLabel,
    toModelCapabilityPatch
} from "./utils"

export const ModelDiscoveryField: React.FC<ModelDiscoveryFieldProps> = ({
    model,
    onChange
}) => {
    const onChangeRef = useRef(onChange)
    const definition = PROVIDER_REGISTRY[model.type]
    const { models, isLoading, errorMessage, manualEntry, refresh } =
        useModelDiscovery(model)
    const apiKey = model.params.apiKey.trim()
    const allowManualModelId = definition.discovery === "siliconflow"
    const [manualDraft, setManualDraft] = useState<{
        modelId: string
        value: string
    } | null>(null)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

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

    if (manualEntry && !allowManualModelId) {
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
            <Select
                key={model.id}
                searchPlaceholder="搜索可用模型"
                emptyMessage="未找到匹配的模型"
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
                onChange={selected => {
                    setManualDraft(null)
                    const value = String(selected)
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
                    onClick={refresh}
                >
                    {isLoading ? "获取中…" : "刷新模型列表"}
                </RefreshButton>
            </FieldMeta>
            {errorMessage && <ErrorText role="alert">{errorMessage}</ErrorText>}
            {allowManualModelId && (
                <div onBlur={() => setManualDraft(null)}>
                    <ApiKeyInput
                        id={`manual-model-name-${model.id}`}
                        label="手动填写模型 ID"
                        value={
                            manualDraft?.modelId === model.id
                                ? manualDraft.value
                                : model.params.modelName
                        }
                        disabledVisitable
                        onChange={value => {
                            setManualDraft({ modelId: model.id, value })
                            onChange(value, undefined)
                        }}
                        placeholder="请输入完整模型 ID"
                        helperText={
                            apiKey &&
                            !isLoading &&
                            !errorMessage &&
                            !models.length
                                ? "未返回可用模型，可手动填写"
                                : undefined
                        }
                    />
                </div>
            )}
        </FieldStack>
    )
}
