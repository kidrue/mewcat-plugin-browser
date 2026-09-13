import { useAtom, useSetAtom } from "jotai"
import * as React from "react"
import styled from "styled-components"

import {
    Button,
    FormRow,
    NativeSelect,
    OptionsSection,
    Switch
} from "@/components"
import { OptionsPageIntro } from "@/components/OptionsPageLayout"
import { useModelDiscovery } from "@/hooks/useModelDiscovery"
import { translateStructuredImageViaBackground } from "@/services/imageTranslation"
import { configAtom, updateConfigAtom } from "@/state"
import {
    buildVisionModelSelectionOptions,
    createVisionModelSelectionKey,
    getImageTranslationConfigRepair,
    getVisionServiceOptions
} from "@/utils/visionModels"

const Guidance = styled.p`
    margin: 0;
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);
`

const Notice = styled.div`
    padding: var(--space-3);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);
`

const TestStatus = styled.p<{ $status: "success" | "error" }>`
    margin: 0;
    color: ${props =>
        props.$status === "success" ? "var(--jade)" : "var(--error)"};
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);
`

const ManualModelInput = styled.input`
    width: 100%;
    height: 36px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font: inherit;

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }
`

type CapabilityTestStatus =
    | { state: "idle" }
    | { state: "loading"; selectionKey: string; requestId: number }
    | { state: "success"; selectionKey: string; requestId: number }
    | {
          state: "error"
          selectionKey: string
          requestId: number
          message: string
      }

function createCapabilityTestImage(): string {
    const canvas = document.createElement("canvas")
    canvas.width = 640
    canvas.height = 320
    const context = canvas.getContext("2d")
    if (!context) {
        throw new Error("当前浏览器无法生成测试图片")
    }

    context.fillStyle = "#f7f3e8"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = "#222222"
    context.font = "bold 34px sans-serif"
    context.fillText("IMAGE TRANSLATION TEST", 44, 82)
    context.font = "26px sans-serif"
    context.fillText("Please translate this sentence:", 44, 154)
    context.fillStyle = "#a32d2d"
    context.fillText("The red fox jumps over the blue river.", 44, 222)

    return canvas.toDataURL("image/png")
}

export const Image: React.FunctionComponent = () => {
    const [config] = useAtom(configAtom)
    const updateConfig = useSetAtom(updateConfigAtom)
    const [testStatus, setTestStatus] = React.useState<CapabilityTestStatus>({
        state: "idle"
    })
    const mountedRef = React.useRef(false)
    const capabilityRequestIdRef = React.useRef(0)
    const selectedSelectionKeyRef = React.useRef("")
    const aiModelList = config.aiModelList
    const visionServiceOptions = React.useMemo(
        () => getVisionServiceOptions(aiModelList),
        [aiModelList]
    )
    const selectedService = visionServiceOptions.find(
        option => option.value === config.imageTranslationModelId
    )?.service
    const { models, isLoading, errorMessage, manualEntry, refresh } =
        useModelDiscovery(selectedService)
    const visionModelOptions = React.useMemo(
        () =>
            buildVisionModelSelectionOptions(
                models,
                config.imageTranslationModelName
            ),
        [config.imageTranslationModelName, models]
    )
    const selectedModelName = config.imageTranslationModelName?.trim() || ""
    const hasSelectedModel = Boolean(selectedService && selectedModelName)
    const selectedSelectionKey = selectedService
        ? createVisionModelSelectionKey(selectedService.id, selectedModelName)
        : ""
    selectedSelectionKeyRef.current = selectedSelectionKey

    React.useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            capabilityRequestIdRef.current += 1
        }
    }, [])

    React.useEffect(() => {
        capabilityRequestIdRef.current += 1
        setTestStatus({ state: "idle" })
    }, [config.targetLanguage, selectedSelectionKey])

    React.useEffect(() => {
        const repair = getImageTranslationConfigRepair(config)
        if (repair) {
            void updateConfig(repair)
        }
    }, [config, updateConfig])

    const handleServiceChange = React.useCallback(
        (imageTranslationModelId: string) => {
            void updateConfig({
                imageTranslationModelId,
                imageTranslationModelName: "",
                enableImageTranslateButton: false
            })
        },
        [updateConfig]
    )

    const handleCapabilityTest = React.useCallback(async () => {
        if (
            !selectedService ||
            !selectedModelName ||
            testStatus.state === "loading"
        ) {
            return
        }

        const requestId = capabilityRequestIdRef.current + 1
        capabilityRequestIdRef.current = requestId
        const testedSelectionKey = selectedSelectionKey
        const isCurrentRequest = () =>
            mountedRef.current &&
            capabilityRequestIdRef.current === requestId &&
            selectedSelectionKeyRef.current === testedSelectionKey

        setTestStatus({
            state: "loading",
            selectionKey: testedSelectionKey,
            requestId
        })
        try {
            const imageUrl = createCapabilityTestImage()
            const result = await translateStructuredImageViaBackground({
                imageUrl,
                targetLanguage: config.targetLanguage,
                modelId: selectedService.id
            })
            if (result.blocks.length === 0) {
                throw new Error("图片中未识别到可翻译文字")
            }
            if (isCurrentRequest()) {
                setTestStatus({
                    state: "success",
                    selectionKey: testedSelectionKey,
                    requestId
                })
            }
        } catch (error) {
            if (isCurrentRequest()) {
                setTestStatus({
                    state: "error",
                    selectionKey: testedSelectionKey,
                    requestId,
                    message:
                        error instanceof Error
                            ? error.message
                            : "未知错误，请重试"
                })
            }
        }
    }, [
        config.targetLanguage,
        selectedModelName,
        selectedSelectionKey,
        selectedService,
        testStatus.state
    ])

    return (
        <>
            <OptionsPageIntro
                scene="garden"
                icon="picture"
                title="图片翻译"
                description="让图片里的文字也能读懂。复用已配置的服务，为图片单独选择合适的视觉模型。"
            />
            <OptionsSection
                artwork="garden"
                icon="picture"
                title="图片翻译"
                description="配置好视觉模型后，即可在网页图片上开启快捷翻译。"
            >
                <FormRow
                    label="图片上显示快捷翻译按钮"
                    description="鼠标悬浮在图片上时显示翻译按钮，点击可翻译图片"
                    controlId="enable-image-translate-button"
                >
                    <Switch
                        id="enable-image-translate-button"
                        aria-describedby="enable-image-translate-button-description"
                        checked={
                            hasSelectedModel &&
                            Boolean(config.enableImageTranslateButton)
                        }
                        disabled={!hasSelectedModel}
                        onChange={checked =>
                            hasSelectedModel &&
                            updateConfig({
                                enableImageTranslateButton: checked
                            })
                        }
                    />
                </FormRow>
            </OptionsSection>
            <OptionsSection
                artwork="postcards"
                icon="mail"
                title="服务与视觉模型"
                description="图片翻译独立使用这里的模型，不影响文本翻译设置。"
            >
                <FormRow
                    label="翻译服务"
                    description="选择“模型”设置中已添加的 AI 服务配置"
                    controlId="image-translation-service"
                >
                    <NativeSelect
                        id="image-translation-service"
                        aria-describedby="image-translation-service-description"
                        value={selectedService?.id ?? ""}
                        onChange={handleServiceChange}
                        disabled={visionServiceOptions.length === 0}
                        options={visionServiceOptions}
                        placeholder="请选择翻译服务"
                    />
                </FormRow>
                <FormRow
                    label="视觉模型"
                    description="图片翻译使用独立模型，不会更改当前文本翻译服务"
                    controlId="image-translation-model"
                >
                    {manualEntry ? (
                        <ManualModelInput
                            id="image-translation-model"
                            aria-describedby="image-translation-model-description"
                            value={selectedModelName}
                            onChange={event =>
                                updateConfig({
                                    imageTranslationModelName:
                                        event.target.value
                                })
                            }
                            placeholder="请输入视觉模型名称"
                        />
                    ) : (
                        <NativeSelect
                            id="image-translation-model"
                            aria-describedby="image-translation-model-description"
                            value={selectedModelName}
                            onChange={imageTranslationModelName =>
                                updateConfig({ imageTranslationModelName })
                            }
                            disabled={
                                !selectedService ||
                                isLoading ||
                                visionModelOptions.length === 0
                            }
                            options={visionModelOptions}
                            placeholder={
                                isLoading
                                    ? "正在获取模型列表…"
                                    : "请选择支持图片输入的模型"
                            }
                        />
                    )}
                    {selectedService && (
                        <Button
                            onClick={refresh}
                            disabled={isLoading || manualEntry}
                        >
                            {isLoading ? "获取中…" : "刷新模型列表"}
                        </Button>
                    )}
                    {!hasSelectedModel && (
                        <Guidance>
                            {!selectedService
                                ? "请先在‘模型’设置中添加并启用 AI 平台并填写 API Key"
                                : isLoading
                                  ? "正在获取模型列表…"
                                  : visionModelOptions.length === 0 &&
                                      !manualEntry
                                    ? "未发现支持图片的模型，请刷新或手动填写模型名称"
                                    : "请选择视觉模型后再启用图片翻译或运行能力测试。"}
                        </Guidance>
                    )}
                    {errorMessage && (
                        <Guidance role="alert">{errorMessage}</Guidance>
                    )}
                </FormRow>
            </OptionsSection>
            <OptionsSection
                artwork="desk"
                title="视觉能力测试"
                description="准备好后，用一张测试图片确认模型可以识别并翻译文字。"
            >
                <FormRow
                    label="视觉能力测试"
                    description="使用运行时生成的图片验证所选模型能否识别并翻译图片文字"
                >
                    <Button
                        onClick={handleCapabilityTest}
                        disabled={
                            !hasSelectedModel || testStatus.state === "loading"
                        }
                    >
                        {testStatus.state === "loading"
                            ? "测试中…"
                            : "测试视觉能力"}
                    </Button>
                    {testStatus.state === "success" && (
                        <TestStatus $status="success" role="status">
                            视觉能力测试成功
                        </TestStatus>
                    )}
                    {testStatus.state === "error" && (
                        <TestStatus $status="error" role="alert">
                            视觉能力测试失败：{testStatus.message}
                        </TestStatus>
                    )}
                    <Notice>
                        能力测试和实际翻译会将图片发送给所选模型服务商，可能产生服务商费用；API
                        Key 仅由扩展后台读取。
                    </Notice>
                </FormRow>
            </OptionsSection>
        </>
    )
}
