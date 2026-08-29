import {
    DndContext,
    MouseSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useAtom, useSetAtom } from "jotai"
import { nanoid } from "nanoid"
import { move } from "ramda"
import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { styled } from "styled-components"

import {
    ApiKeyInput,
    Button,
    CustomSelect,
    FormRow,
    ModelTestPanel,
    NumberInput,
    OptionsSection,
    Switch
} from "@/components"
import { AddModel } from "@/components/AddModel"
import { AIModelEmptyState } from "@/components/AIModelEmptyState"
import { ModelDiscoveryField } from "@/components/ModelDiscoveryField"
import { DEFAULT_VALUES, platformNameMap } from "@/constants"
import { AiRoleOptions, AiRoleSystemPrompts } from "@/constants/aiRole"
import {
    getGenerationBaseUrl,
    PROVIDER_REGISTRY
} from "@/model-management/providers"
import {
    configAtom,
    getTranslationServiceOptions,
    resolveTranslationServiceId,
    updateAiModelConfigAtom,
    updateConfigAtom
} from "@/state"
import { hideScrollBar } from "@/styles/scroll"
import { testConfiguredModel } from "@/translation/translationService"
import type { AiModel_Platform_Enum } from "@/types"
import { AiRole, type BaseModel } from "@/types"
import { getModelByModelList, isModelThinkingCapable } from "@/utils/llmModel"
import { Toast, ToastType } from "@/utils/toast"
import { isVisionCapableModel } from "@/utils/visionModels"

import { AI_MODEL_UI_LIST } from "./constants"

const ModelListContainer = styled.div`
    display: flex;
    gap: var(--space-6);
    min-height: 400px;
    max-height: 600px;

    /* 窄屏放弃左右分栏：目录在上、配置在下 */
    @media (max-width: 900px) {
        flex-direction: column;
        max-height: none;
        min-height: 0;
        gap: var(--space-4);
    }
`

const ModelList = styled.div`
    width: 280px;
    flex-shrink: 0;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 100%;
    overflow: auto;
    border-radius: var(--radius-lg);
    ${hideScrollBar}

    @media (max-width: 900px) {
        width: 100%;
        max-height: 240px;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }
`

const ModelConfigContainer = styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-height: 100%;
    overflow: auto;
    ${hideScrollBar}

    @media (max-width: 900px) {
        max-height: none;
    }
`

const ModelHeader = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--space-3);
    gap: var(--space-4);
`

const ModelHeaderContent = styled.div`
    flex: 1;
    min-width: 0;
`

const ModelHeaderActions = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
    padding-top: 2px;
`

const ModelTitle = styled.h3`
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
`

const ModelDescription = styled.p`
    margin: var(--space-2) 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: var(--line-height-normal);
`

const ConfigForm = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
`

const SourceToggleGroup = styled.div`
    display: inline-flex;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: hidden;
`

const SourceToggleButton = styled.button<{ $active: boolean }>`
    padding: var(--space-2) var(--space-4);
    border: none;
    background: ${p =>
        p.$active ? "var(--primary-color)" : "var(--bg-secondary)"};
    color: ${p => (p.$active ? "var(--text-inverse)" : "var(--text-primary)")};
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);

    &:hover {
        background: ${p =>
            p.$active ? "var(--primary-hover)" : "var(--gray-100)"};
    }

    & + & {
        border-left: 1px solid var(--border-color);
    }
`

const ModelItem = styled.div<{ $selected: boolean }>`
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: ${props =>
        props.$selected ? "var(--seal-wash)" : "transparent"};
    color: ${props =>
        props.$selected ? "var(--primary-color)" : "var(--text-primary)"};
    /* 选中态压一道朱砂边，不靠投影 —— 列表里每行都可点，投影会退化成无意义装饰 */
    box-shadow: ${props =>
        props.$selected ? "inset 3px 0 0 var(--primary-color)" : "none"};
    transition:
        background var(--transition-fast),
        box-shadow var(--transition-fast);

    &:hover {
        background: ${props =>
            props.$selected ? "var(--seal-wash)" : "var(--bg-tertiary)"};
    }
`

const ModelItemContent = styled.div`
    flex: 1;
    min-width: 0;
`

const ModelItemTitle = styled.div`
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: var(--space-2);
`

const ModelItemSubtitle = styled.div`
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`

const ModelItemActions = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
`

const StatusDot = styled.div<{ $enabled: boolean }>`
    width: 6px;
    height: 6px;
    background: ${props =>
        props.$enabled ? "var(--jade)" : "var(--gray-300)"};
    border-radius: var(--radius-full);
    flex-shrink: 0;
`

const RoleHelperText = styled.div`
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    line-height: var(--line-height-normal);
`

const LoadingSpinner = styled.div`
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: var(--radius-full);
    border-top-color: white;
    animation: spin 0.6s linear infinite;

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
`

const TestSection = styled.div`
    margin-bottom: var(--space-5);
    padding: var(--space-4);
    background: var(--bg-tertiary);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-light);
`

const TestHeader = styled.div`
    margin-bottom: var(--space-3);
`

const TestTitle = styled.h4`
    margin: 0 0 var(--space-1) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
`

const TestDescription = styled.p`
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
`

function LeftPanelItem({
    model,
    isEnabled,
    isSelected,
    isDragging,
    onClick,
    onToggleEnabled,
    id
}: {
    id: string
    model: BaseModel
    isEnabled: boolean
    isSelected: boolean
    isDragging: boolean
    onClick: React.MouseEventHandler<HTMLDivElement>
    onToggleEnabled: (enabled: boolean) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        boxShadow: isDragging ? "0 0 0 4px var(--primary-color)" : undefined
    }

    const handleSwitchClick = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    const subtitle =
        model.params.modelName ||
        (model.params.isOfficial === false ? "自定义" : "官方")

    return (
        <ModelItem
            key={model.type}
            {...attributes}
            {...listeners}
            onClick={onClick}
            ref={setNodeRef}
            $selected={isSelected}
            style={style}
        >
            <StatusDot $enabled={isEnabled} />
            <ModelItemContent>
                <ModelItemTitle>{model.name}</ModelItemTitle>
                <ModelItemSubtitle>{subtitle}</ModelItemSubtitle>
            </ModelItemContent>
            <ModelItemActions onClick={handleSwitchClick}>
                <Switch
                    checked={isEnabled}
                    onChange={onToggleEnabled}
                    size="sm"
                />
            </ModelItemActions>
        </ModelItem>
    )
}

export function hasConfiguredAiModels(aiModelList?: BaseModel[]): boolean {
    return Boolean(aiModelList?.length)
}

export const TranslateServices: React.FunctionComponent = () => {
    const [config] = useAtom(configAtom)
    const updateConfig = useSetAtom(updateConfigAtom)
    const updateAiModelConfig = useSetAtom(updateAiModelConfigAtom)
    const [dragId, setDragId] = useState<string | null>(null)
    const [activeId, setActiveId] = useState<string>(
        config?.aiModelList?.[0]?.id
    )

    const [testStatus, setTestStatus] = useState<{
        [key: string]: "idle" | "loading" | "success" | "error"
    }>({})
    const [testTimers, setTestTimers] = useState<{
        [key: string]: NodeJS.Timeout
    }>({})
    const [testCountdown, setTestCountdown] = useState<{
        [key: string]: number
    }>({})

    const prevActiveIdRef = useRef<string | undefined>(activeId)

    const currentModelData: BaseModel | undefined = config?.aiModelList?.find?.(
        m => m.id === activeId
    )
    const currentModelConfig = AI_MODEL_UI_LIST.find?.(
        m => m.type === currentModelData?.type
    )
    const isOfficial = currentModelData?.params?.isOfficial !== false
    const officialBaseUrl = currentModelData
        ? getGenerationBaseUrl(currentModelData.type, true)
        : ""

    const handleTestModel = useCallback(() => {
        if (!currentModelData.params.apiKey.trim()) {
            return Promise.reject(new Error("请先填写 API Key"))
        }
        return testConfiguredModel(
            currentModelData,
            config.targetLanguage,
            AiRole.DEFAULT
        ).then(result => result.trim().length > 0)
    }, [config.targetLanguage, currentModelData])

    const handleTestSingleModel = useCallback(
        async (modelId: string) => {
            const model = getModelByModelList(
                config?.aiModelList || [],
                modelId
            )
            if (!model) {
                return
            }

            if (testTimers[modelId]) {
                clearTimeout(testTimers[modelId])
            }

            setTestStatus(prev => {
                return { ...prev, [modelId]: "loading" }
            })
            setTestCountdown(prev => ({ ...prev, [modelId]: 0 }))

            const startTime = Date.now()

            try {
                const translatedText = await testConfiguredModel(
                    model,
                    config.targetLanguage,
                    AiRole.DEFAULT
                )

                const duration = Date.now() - startTime

                const success =
                    translatedText &&
                    translatedText.trim().length > 0 &&
                    translatedText.toLowerCase() !== "hello, world!"

                setTestStatus(prev => ({
                    ...prev,
                    [modelId]: success ? "success" : "error"
                }))

                Toast.show({
                    type: success ? ToastType.SUCCESS : ToastType.ERROR,
                    message: success
                        ? `${model.name} 测试成功 (${duration}ms)`
                        : `${model.name} 测试失败: 翻译结果无效`,
                    duration: 3000
                })

                setTestCountdown(prev => ({ ...prev, [modelId]: 5 }))

                let countdown = 5
                const countdownInterval = setInterval(() => {
                    countdown -= 1
                    if (countdown > 0) {
                        setTestCountdown(prev => ({
                            ...prev,
                            [modelId]: countdown
                        }))
                    } else {
                        clearInterval(countdownInterval)
                    }
                }, 1000)

                const timer = setTimeout(() => {
                    setTestStatus(prev => ({ ...prev, [modelId]: "idle" }))
                    setTestCountdown(prev => {
                        const newCountdown = { ...prev }
                        delete newCountdown[modelId]
                        return newCountdown
                    })
                    setTestTimers(prev => {
                        const newTimers = { ...prev }
                        delete newTimers[modelId]
                        return newTimers
                    })
                }, 5000)

                setTestTimers(prev => ({ ...prev, [modelId]: timer }))
            } catch (error) {
                const duration = Date.now() - startTime
                setTestStatus(prev => ({ ...prev, [modelId]: "error" }))

                Toast.show({
                    type: ToastType.ERROR,
                    message: `${model.name} 测试失败 (${duration}ms): ${error instanceof Error ? error.message : "未知错误"}`,
                    duration: 3000
                })

                setTestCountdown(prev => ({ ...prev, [modelId]: 5 }))

                let countdown = 5
                const countdownInterval = setInterval(() => {
                    countdown -= 1
                    if (countdown > 0) {
                        setTestCountdown(prev => ({
                            ...prev,
                            [modelId]: countdown
                        }))
                    } else {
                        clearInterval(countdownInterval)
                    }
                }, 1000)

                const timer = setTimeout(() => {
                    setTestStatus(prev => ({ ...prev, [modelId]: "idle" }))
                    setTestCountdown(prev => {
                        const newCountdown = { ...prev }
                        delete newCountdown[modelId]
                        return newCountdown
                    })
                    setTestTimers(prev => {
                        const newTimers = { ...prev }
                        delete newTimers[modelId]
                        return newTimers
                    })
                }, 5000)

                setTestTimers(prev => ({ ...prev, [modelId]: timer }))
            }
        },
        [config?.aiModelList, config?.targetLanguage, testTimers]
    )

    useEffect(() => {
        return () => {
            Object.values(testTimers).forEach(timer => clearTimeout(timer))
        }
    }, [testTimers])

    useEffect(() => {
        const prevActiveId = prevActiveIdRef.current

        if (prevActiveId && prevActiveId !== activeId) {
            setTestStatus(prev => {
                const newStatus = { ...prev }
                delete newStatus[prevActiveId]
                return newStatus
            })
            setTestCountdown(prev => {
                const newCountdown = { ...prev }
                delete newCountdown[prevActiveId]
                return newCountdown
            })
            if (testTimers[prevActiveId]) {
                clearTimeout(testTimers[prevActiveId])
                setTestTimers(prev => {
                    const newTimers = { ...prev }
                    delete newTimers[prevActiveId]
                    return newTimers
                })
            }
        }

        prevActiveIdRef.current = activeId
    }, [activeId, testTimers])

    const getTestButtonText = useCallback(
        (modelId: string) => {
            const status = testStatus[modelId] || "idle"
            const countdown = testCountdown[modelId]

            switch (status) {
                case "loading":
                    return (
                        <>
                            <LoadingSpinner />
                            <span style={{ marginLeft: "8px" }}>测试</span>
                        </>
                    )
                case "success":
                    return countdown ? `测试成功 (${countdown}s)` : "测试成功"
                case "error":
                    return countdown ? `测试失败 (${countdown}s)` : "测试失败"
                default:
                    return "测试"
            }
        },
        [testStatus, testCountdown]
    )

    const onDragStart = useCallback(
        (e: DragStartEvent) => {
            setDragId(e.active.id.toString())
        },
        [setDragId]
    )

    const onDragEnd = useCallback(
        ({ active, over }: DragEndEvent) => {
            setDragId(null)
            if (active.id === over?.id) {
                return
            }
            const newModelList = [...(config?.aiModelList || [])]
            const activeIndex = newModelList.findIndex(
                model => model.id === active.id
            )
            const overIndex = newModelList.findIndex(
                model => model.id === over?.id
            )
            if (activeIndex !== -1 && overIndex !== -1) {
                updateConfig({
                    aiModelList: move(activeIndex, overIndex, newModelList)
                })
            }
        },
        [config?.aiModelList, updateConfig]
    )

    const onRemoveModel = useCallback(
        (id: string) => {
            updateConfig({
                aiModelList:
                    config?.aiModelList?.filter?.(model => model.id !== id) ||
                    []
            })
        },
        [config?.aiModelList, updateConfig]
    )

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } })
    )

    const handleAddModel = useCallback(
        (platform: AiModel_Platform_Enum) => {
            updateConfig({
                aiModelList: [
                    ...(config?.aiModelList || []),
                    {
                        id: nanoid(),
                        type: platform,
                        enabled: true,
                        name: platformNameMap[platform],
                        params: {
                            modelName: "",
                            isOfficial: true,
                            apiKey: "",
                            baseUrl: ""
                        }
                    }
                ]
            })
        },
        [config?.aiModelList, updateConfig]
    )

    const handleSourceChange = useCallback(
        (nextIsOfficial: boolean) => {
            if (!currentModelData) {
                return
            }
            updateAiModelConfig({
                id: currentModelData.id,
                params: {
                    isOfficial: nextIsOfficial,
                    // 官方模式不持久化 baseUrl（运行时通过统一供应商注册表映射）；
                    // 切到自定义时仅保留用户已填的值，留空让用户主动填写
                    baseUrl: nextIsOfficial
                        ? ""
                        : currentModelData.params.baseUrl || ""
                }
            })
        },
        [currentModelData, updateAiModelConfig]
    )

    const currentModelOptions = React.useMemo(
        () => getTranslationServiceOptions(config?.aiModelList || []),
        [config?.aiModelList]
    )

    const handleCurrentModelChange = useCallback(
        (value: string) => {
            const selectedModel = config?.aiModelList?.find(
                model => model.id === value
            )

            if (selectedModel && !isModelThinkingCapable(selectedModel)) {
                updateConfig({
                    currentModel: value,
                    enableThinking: false
                })
            } else {
                updateConfig({ currentModel: value })
            }
        },
        [config?.aiModelList, updateConfig]
    )

    useEffect(() => {
        const resolvedServiceId = resolveTranslationServiceId({
            currentModel: config?.currentModel,
            aiModelList: config?.aiModelList || []
        })

        if (resolvedServiceId !== config?.currentModel) {
            updateConfig({ currentModel: resolvedServiceId })
        }
    }, [config?.aiModelList, config?.currentModel, updateConfig])

    useEffect(() => {
        const firstModelId = config?.aiModelList?.[0]?.id
        const activeModelStillExists = config?.aiModelList?.some(
            model => model.id === activeId
        )

        if (firstModelId && !activeModelStillExists) {
            setActiveId(firstModelId)
        }
    }, [activeId, config?.aiModelList])

    const currentModelSupportsThinking = React.useMemo(() => {
        const currentModel = config?.aiModelList?.find(
            model => model.id === activeId
        )
        return isModelThinkingCapable(currentModel)
    }, [activeId, config?.aiModelList])

    const hasModels = hasConfiguredAiModels(config?.aiModelList)

    return (
        <>
            <OptionsSection title="模型">
                <FormRow
                    label="当前翻译服务"
                    description="选择当前用于翻译的服务"
                >
                    <CustomSelect
                        value={String(config.currentModel)}
                        onChange={value =>
                            typeof value === "string" &&
                            handleCurrentModelChange(value)
                        }
                        options={currentModelOptions}
                        placeholder="选择服务"
                    />
                </FormRow>
            </OptionsSection>
            <OptionsSection
                title="AI模型"
                rightSection={
                    hasModels ? (
                        <AddModel onItemClick={handleAddModel} />
                    ) : undefined
                }
            >
                {hasModels ? (
                    <ModelListContainer>
                        <DndContext
                            onDragEnd={onDragEnd}
                            onDragStart={onDragStart}
                            modifiers={[restrictToVerticalAxis]}
                            sensors={sensors}
                        >
                            <SortableContext
                                items={
                                    config?.aiModelList.map(
                                        model => model.id
                                    ) || []
                                }
                                strategy={verticalListSortingStrategy}
                            >
                                <ModelList>
                                    {config?.aiModelList?.map(model => (
                                        <LeftPanelItem
                                            key={model.id}
                                            id={model.id}
                                            model={model}
                                            isDragging={
                                                dragId === model.id.toString()
                                            }
                                            isEnabled={model.enabled}
                                            isSelected={activeId === model.id}
                                            onClick={() =>
                                                setActiveId(model.id)
                                            }
                                            onToggleEnabled={enabled =>
                                                updateAiModelConfig({
                                                    id: model.id,
                                                    enabled
                                                })
                                            }
                                        />
                                    ))}
                                </ModelList>
                            </SortableContext>
                        </DndContext>
                        <ModelConfigContainer>
                            {currentModelData && (
                                <>
                                    <ModelHeader>
                                        <ModelHeaderContent>
                                            <ModelTitle>
                                                {currentModelData.name}
                                            </ModelTitle>
                                            <ModelDescription>
                                                {
                                                    currentModelConfig?.description
                                                }
                                            </ModelDescription>
                                        </ModelHeaderContent>
                                        <ModelHeaderActions>
                                            <Button
                                                type="primary"
                                                size="sm"
                                                onClick={() =>
                                                    handleTestSingleModel(
                                                        currentModelData.id
                                                    )
                                                }
                                                disabled={
                                                    testStatus[
                                                        currentModelData.id
                                                    ] === "loading" ||
                                                    testStatus[
                                                        currentModelData.id
                                                    ] === "success" ||
                                                    testStatus[
                                                        currentModelData.id
                                                    ] === "error"
                                                }
                                            >
                                                {getTestButtonText(
                                                    currentModelData.id
                                                )}
                                            </Button>

                                            <Button
                                                type="secondary"
                                                size="sm"
                                                onClick={() =>
                                                    onRemoveModel(
                                                        currentModelData.id
                                                    )
                                                }
                                            >
                                                删除模型
                                            </Button>
                                        </ModelHeaderActions>
                                    </ModelHeader>
                                    <ConfigForm>
                                        <FormRow
                                            label="模型类型"
                                            description="官方模型使用平台默认请求地址；选择自定义可填写代理或私有部署地址"
                                        >
                                            <SourceToggleGroup>
                                                <SourceToggleButton
                                                    type="button"
                                                    $active={isOfficial}
                                                    onClick={() =>
                                                        handleSourceChange(true)
                                                    }
                                                >
                                                    官方模型
                                                </SourceToggleButton>
                                                <SourceToggleButton
                                                    type="button"
                                                    $active={!isOfficial}
                                                    onClick={() =>
                                                        handleSourceChange(
                                                            false
                                                        )
                                                    }
                                                >
                                                    自定义
                                                </SourceToggleButton>
                                            </SourceToggleGroup>
                                        </FormRow>
                                        <FormRow
                                            label="请求地址"
                                            required={!isOfficial}
                                        >
                                            <ApiKeyInput
                                                label="请求地址"
                                                value={
                                                    isOfficial
                                                        ? officialBaseUrl
                                                        : currentModelData
                                                              .params.baseUrl ||
                                                          ""
                                                }
                                                disabledVisitable={true}
                                                disabled={isOfficial}
                                                onChange={value =>
                                                    updateAiModelConfig({
                                                        id: currentModelData.id,
                                                        params: {
                                                            baseUrl: value
                                                        }
                                                    })
                                                }
                                                placeholder={
                                                    isOfficial
                                                        ? officialBaseUrl
                                                        : "请输入自定义请求地址（如代理或私有部署）"
                                                }
                                                helperText={
                                                    isOfficial
                                                        ? "已选择官方模型，使用平台默认地址"
                                                        : "自定义请求地址生效，请确保地址可用"
                                                }
                                            />
                                        </FormRow>
                                        {!isOfficial && (
                                            <FormRow
                                                label="支持图片输入"
                                                description="自定义模型需显式声明视觉能力，开启后可用于图片翻译"
                                                controlId="custom-model-vision-capability"
                                            >
                                                <Switch
                                                    id="custom-model-vision-capability"
                                                    aria-describedby="custom-model-vision-capability-description"
                                                    checked={isVisionCapableModel(
                                                        currentModelData
                                                    )}
                                                    onChange={vision =>
                                                        updateAiModelConfig({
                                                            id: currentModelData.id,
                                                            capabilities: {
                                                                ...currentModelData.capabilities,
                                                                vision
                                                            }
                                                        })
                                                    }
                                                />
                                            </FormRow>
                                        )}
                                        {PROVIDER_REGISTRY[
                                            currentModelData.type
                                        ].discovery !== "none" && (
                                            <FormRow
                                                label="模型名称"
                                                required
                                                description="自动获取当前账号或接口可用的模型，并标记图片输入能力"
                                                controlId={`model-name-${currentModelData.id}`}
                                            >
                                                <ModelDiscoveryField
                                                    model={currentModelData}
                                                    onChange={(
                                                        modelName,
                                                        capabilities
                                                    ) =>
                                                        updateAiModelConfig({
                                                            id: currentModelData.id,
                                                            params: {
                                                                modelName
                                                            },
                                                            capabilities: {
                                                                ...currentModelData.capabilities,
                                                                vision: capabilities?.vision
                                                            }
                                                        })
                                                    }
                                                />
                                            </FormRow>
                                        )}
                                        {currentModelConfig?.items?.map(
                                            item => {
                                                const fieldConfig =
                                                    currentModelConfig.fields[
                                                        item
                                                    ]
                                                if (!fieldConfig) {
                                                    return null
                                                }
                                                return (
                                                    <FormRow
                                                        key={item}
                                                        label={
                                                            fieldConfig.label
                                                        }
                                                        required={
                                                            fieldConfig.required
                                                        }
                                                    >
                                                        <ApiKeyInput
                                                            label={
                                                                fieldConfig.label
                                                            }
                                                            value={
                                                                currentModelData
                                                                    ?.params?.[
                                                                    item
                                                                ]
                                                                    ? String(
                                                                          currentModelData
                                                                              ?.params?.[
                                                                              item
                                                                          ]
                                                                      )
                                                                    : ""
                                                            }
                                                            disabledVisitable={
                                                                item !==
                                                                "apiKey"
                                                            }
                                                            onChange={value => {
                                                                updateAiModelConfig(
                                                                    {
                                                                        id: currentModelData.id,
                                                                        params: {
                                                                            [item]: value
                                                                        }
                                                                    }
                                                                )
                                                            }}
                                                            placeholder={
                                                                fieldConfig.placeholder
                                                            }
                                                            helperText={
                                                                fieldConfig.helperText
                                                            }
                                                            helperLink={
                                                                fieldConfig.helperLink
                                                            }
                                                            onTest={
                                                                item ===
                                                                "apiKey"
                                                                    ? handleTestModel
                                                                    : undefined
                                                            }
                                                        />
                                                    </FormRow>
                                                )
                                            }
                                        )}
                                    </ConfigForm>
                                </>
                            )}
                        </ModelConfigContainer>
                    </ModelListContainer>
                ) : (
                    <AIModelEmptyState onItemClick={handleAddModel} />
                )}
            </OptionsSection>

            <OptionsSection title="配置">
                {hasModels && (
                    <TestSection>
                        <TestHeader>
                            <TestTitle>模型测试</TestTitle>
                            <TestDescription>
                                测试所有可用模型的翻译能力
                            </TestDescription>
                        </TestHeader>
                        <ModelTestPanel
                            modelList={config.aiModelList}
                            testText="Hello, world!"
                            targetLang={config.targetLanguage}
                        />
                    </TestSection>
                )}
                {currentModelSupportsThinking && (
                    <FormRow
                        label="启用思考能力"
                        description="为支持思考的模型（如 DeepSeek R1、QwQ、Thinking 系列）启用深度推理能力，可能会增加响应时间"
                    >
                        <Switch
                            checked={config.enableThinking || false}
                            onChange={checked =>
                                updateConfig({ enableThinking: checked })
                            }
                        />
                    </FormRow>
                )}
                <FormRow
                    label="每秒最大请求数"
                    description="限制AI模型的请求频率"
                >
                    <NumberInput
                        value={
                            config.maxRequestsPerSecond ||
                            DEFAULT_VALUES.maxRequestsPerSecond
                        }
                        onChange={value =>
                            updateConfig({ maxRequestsPerSecond: value })
                        }
                        placeholder={String(
                            DEFAULT_VALUES.maxRequestsPerSecond
                        )}
                        min={1}
                        max={100}
                    />
                </FormRow>
                <FormRow
                    label="每次请求最大文本长度"
                    description="单次请求的文本字符数限制"
                >
                    <NumberInput
                        value={
                            config.maxTextLengthPerRequest ||
                            DEFAULT_VALUES.maxTextLengthPerRequest
                        }
                        onChange={value =>
                            updateConfig({ maxTextLengthPerRequest: value })
                        }
                        placeholder={String(
                            DEFAULT_VALUES.maxTextLengthPerRequest
                        )}
                        min={100}
                        max={10000}
                    />
                </FormRow>
                <FormRow
                    label="AI专家角色"
                    description="选择AI翻译时的专家角色，不同角色会影响翻译风格"
                >
                    <CustomSelect
                        value={config.aiRole || AiRole.DEFAULT}
                        onChange={value =>
                            typeof value === "string" &&
                            updateConfig({ aiRole: value as AiRole })
                        }
                        options={AiRoleOptions}
                        placeholder="选择AI专家角色"
                    />
                    <RoleHelperText>
                        {
                            AiRoleSystemPrompts[
                                config.aiRole || AiRole.DEFAULT
                            ]?.split("\n")[0]
                        }
                    </RoleHelperText>
                </FormRow>
                <FormRow
                    label="启用AI智能上下文"
                    description="结合网页上下文提升翻译效果，需要配置 LLM 翻译服务商。注意：开启后会增加翻译时长"
                >
                    <Switch
                        checked={config.enableContext || false}
                        onChange={checked =>
                            updateConfig({ enableContext: checked })
                        }
                    />
                </FormRow>
            </OptionsSection>
        </>
    )
}

export default TranslateServices
