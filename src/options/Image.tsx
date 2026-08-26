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
import { translateStructuredImageViaBackground } from "@/services/imageTranslation"
import { configAtom, updateConfigAtom } from "@/state"
import {
    getImageTranslationConfigRepair,
    getVisionModelOptions
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

type CapabilityTestStatus =
    | { state: "idle" }
    | { state: "loading"; modelId: string; requestId: number }
    | { state: "success"; modelId: string; requestId: number }
    | { state: "error"; modelId: string; requestId: number; message: string }

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
    const selectedModelIdRef = React.useRef("")
    const visionModelOptions = React.useMemo(
        () => getVisionModelOptions(config.aiModelList || []),
        [config.aiModelList]
    )
    const selectedModelId = visionModelOptions.some(
        option => option.value === config.imageTranslationModelId
    )
        ? config.imageTranslationModelId || ""
        : ""
    const hasSelectedModel = selectedModelId.length > 0
    selectedModelIdRef.current = selectedModelId

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
    }, [config.targetLanguage, selectedModelId])

    React.useEffect(() => {
        const repair = getImageTranslationConfigRepair(config)
        if (repair) {
            void updateConfig(repair)
        }
    }, [config, updateConfig])

    const handleCapabilityTest = React.useCallback(async () => {
        if (!selectedModelId || testStatus.state === "loading") {
            return
        }

        const requestId = capabilityRequestIdRef.current + 1
        capabilityRequestIdRef.current = requestId
        const testedModelId = selectedModelId
        const isCurrentRequest = () =>
            mountedRef.current &&
            capabilityRequestIdRef.current === requestId &&
            selectedModelIdRef.current === testedModelId

        setTestStatus({
            state: "loading",
            modelId: testedModelId,
            requestId
        })
        try {
            const imageUrl = createCapabilityTestImage()
            const result = await translateStructuredImageViaBackground({
                imageUrl,
                targetLanguage: config.targetLanguage,
                modelId: testedModelId
            })
            if (result.blocks.length === 0) {
                throw new Error("图片中未识别到可翻译文字")
            }
            if (isCurrentRequest()) {
                setTestStatus({
                    state: "success",
                    modelId: testedModelId,
                    requestId
                })
            }
        } catch (error) {
            if (isCurrentRequest()) {
                setTestStatus({
                    state: "error",
                    modelId: testedModelId,
                    requestId,
                    message:
                        error instanceof Error
                            ? error.message
                            : "未知错误，请重试"
                })
            }
        }
    }, [config.targetLanguage, selectedModelId, testStatus.state])

    return (
        <>
            <OptionsSection title="图片翻译">
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

                <FormRow
                    label="视觉模型"
                    description="图片翻译使用独立模型，不会更改当前文本翻译服务"
                    controlId="image-translation-model"
                >
                    <NativeSelect
                        id="image-translation-model"
                        aria-describedby="image-translation-model-description"
                        value={selectedModelId}
                        onChange={imageTranslationModelId =>
                            updateConfig({ imageTranslationModelId })
                        }
                        disabled={visionModelOptions.length === 0}
                        options={visionModelOptions}
                        placeholder="请选择支持图片输入的模型"
                    />
                    {!hasSelectedModel && (
                        <Guidance>
                            {visionModelOptions.length === 0
                                ? "请先在“模型”设置中配置并启用支持图片输入的模型。"
                                : "请选择视觉模型后再启用图片翻译或运行能力测试。"}
                        </Guidance>
                    )}
                </FormRow>

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
