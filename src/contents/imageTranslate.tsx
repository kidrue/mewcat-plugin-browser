import { useAtomValue } from "jotai"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheetManager } from "styled-components"

import { ImageTranslateButton } from "@/components/ImageTranslateButton"
import { extensionShadowRootContainerId } from "@/constants"
import {
    ensureCanvasHookInjected,
    ensureCanvasId,
    queryCanvasMeta
} from "@/contents/bridges/canvas-hook-bridge"
import {
    createImageTranslationController,
    type ImageTranslationController
} from "@/contents/imageTranslationController"
import {
    createImageTranslationOverlay,
    hasSupportedTargetTransform
} from "@/contents/imageTranslationOverlay"
import {
    translateStructuredImageViaBackground,
    validateImage
} from "@/services/imageTranslation"
import { configAtom } from "@/state"
import type { CanvasHookMeta } from "@/types/canvas-hook"
import { Toast, ToastType } from "@/utils/toast"
import { isImageTranslationEnabled } from "@/utils/visionModels"

import "@/styles/theme.scss"

export const getShadowHostId = () => "mewcat-image-translate"

interface ImageTranslateState {
    currentTarget: HTMLImageElement | HTMLCanvasElement | null
    buttonVisible: boolean
    buttonPosition: { x: number; y: number }
    translating: boolean
}

function isImageElement(value: EventTarget | null): value is HTMLImageElement {
    return value instanceof HTMLImageElement
}

function isCanvasElement(
    value: EventTarget | null
): value is HTMLCanvasElement {
    return value instanceof HTMLCanvasElement
}

export const ImageTranslate: React.FC = () => {
    const config = useAtomValue(configAtom)
    const imageTranslationEnabled = isImageTranslationEnabled(config)
    const [state, setState] = useState<ImageTranslateState>({
        currentTarget: null,
        buttonVisible: false,
        buttonPosition: { x: 0, y: 0 },
        translating: false
    })

    // 用于存储隐藏按钮的定时器
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    // 用 ref 跟踪状态，避免事件 handler 闭包捕获旧值
    const currentTargetRef = useRef<
        HTMLImageElement | HTMLCanvasElement | null
    >(null)
    currentTargetRef.current = state.currentTarget
    const translatingRef = useRef(false)
    translatingRef.current = state.translating
    const mountedRef = useRef(false)
    const controllerRef = useRef<ImageTranslationController | null>(null)
    if (!controllerRef.current) {
        controllerRef.current = createImageTranslationController({
            createOverlay: (target, result, onDestroy) =>
                createImageTranslationOverlay(target, result, { onDestroy }),
            isEligible: hasSupportedTargetTransform
        })
    }

    // 计算按钮位置（图片右下角）
    const calculateButtonPosition = useCallback(
        (
            target: HTMLImageElement | HTMLCanvasElement
        ): { x: number; y: number } => {
            const rect = target.getBoundingClientRect()
            return {
                x: rect.right - 50, // 距离右边 10px
                y: rect.bottom - 50 // 距离底部 10px
            }
        },
        []
    )

    // 清除隐藏定时器
    const clearHideTimeout = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current)
            hideTimeoutRef.current = null
        }
    }, [])

    const getCanvasMetaForTranslate = useCallback(
        async (canvas: HTMLCanvasElement): Promise<CanvasHookMeta | null> => {
            await ensureCanvasHookInjected(window.location.href)
            return queryCanvasMeta(canvas)
        },
        []
    )

    // 处理图片悬浮（用 ref 读取状态，保持 callback 引用稳定）
    const handleImageHover = useCallback(
        (e: MouseEvent) => {
            if (!imageTranslationEnabled) {
                return
            }

            const target = e.target as HTMLElement
            if (!(isImageElement(target) || isCanvasElement(target))) {
                return
            }

            const targetElement = target

            // 验证图片
            const validation = validateImage(targetElement)
            if (
                !validation.valid ||
                !hasSupportedTargetTransform(targetElement)
            ) {
                return
            }

            // 如果正在翻译当前图片，不更新
            if (
                translatingRef.current &&
                currentTargetRef.current === targetElement
            ) {
                return
            }

            // 取消上一张图片的 hide 定时器
            clearHideTimeout()

            const position = calculateButtonPosition(targetElement)
            setState(prev => ({
                ...prev,
                currentTarget: targetElement,
                buttonVisible: true,
                buttonPosition: position
            }))
        },
        [imageTranslationEnabled, calculateButtonPosition, clearHideTimeout]
    )

    // 处理鼠标离开
    const handleMouseLeave = useCallback(
        (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!(isImageElement(target) || isCanvasElement(target))) {
                return
            }

            // 清除之前的定时器
            clearHideTimeout()

            // 延迟隐藏按钮，给用户时间移动到按钮上
            hideTimeoutRef.current = setTimeout(() => {
                setState(prev => {
                    // 如果正在翻译，不隐藏按钮
                    if (prev.translating) {
                        return prev
                    }
                    return {
                        ...prev,
                        buttonVisible: false,
                        currentTarget: null
                    }
                })
            }, 300) // 增加延迟时间到 300ms
        },
        [clearHideTimeout]
    )

    // 处理翻译按钮点击
    const handleTranslateClick = useCallback(async () => {
        if (!state.currentTarget || state.translating) {
            return
        }

        const target = state.currentTarget
        try {
            const action = await controllerRef.current!.translate(
                target,
                config.imageTranslationModelId,
                async () => {
                    setState(prev => ({ ...prev, translating: true }))
                    if (target instanceof HTMLImageElement) {
                        return translateStructuredImageViaBackground({
                            imageUrl: target.src,
                            targetLanguage: config.targetLanguage,
                            modelId: config.imageTranslationModelId!,
                            devicePixelRatio: window.devicePixelRatio,
                            pageUrl: window.location.href
                        })
                    }
                    const canvasId = ensureCanvasId(target)
                    const canvasMeta = await getCanvasMetaForTranslate(target)
                    return translateStructuredImageViaBackground({
                        imageUrl: canvasMeta?.sourceUrl,
                        targetLanguage: config.targetLanguage,
                        modelId: config.imageTranslationModelId!,
                        devicePixelRatio: window.devicePixelRatio,
                        pageUrl: window.location.href,
                        canvasMeta: {
                            canvasId,
                            sourceUrl: canvasMeta?.sourceUrl,
                            renderType: canvasMeta?.renderType || "unknown",
                            sourceContextType:
                                canvasMeta?.sourceContextType || "unknown",
                            targetContextType:
                                canvasMeta?.targetContextType || "unknown"
                        }
                    })
                }
            )

            if (action === "missing-model") {
                Toast.show({
                    type: ToastType.ERROR,
                    message: "请先在设置中选择视觉模型"
                })
                return
            }
            if (action === "in-flight") {
                return
            }
            if (action === "cancelled") {
                if (mountedRef.current) {
                    setState(prev => ({
                        ...prev,
                        translating: false,
                        buttonVisible:
                            prev.currentTarget === target
                                ? false
                                : prev.buttonVisible,
                        currentTarget:
                            prev.currentTarget === target
                                ? null
                                : prev.currentTarget
                    }))
                }
                return
            }
            if (action === "unsupported") {
                setState(prev => ({
                    ...prev,
                    translating: false,
                    buttonVisible: false,
                    currentTarget: null
                }))
                Toast.show({
                    type: ToastType.ERROR,
                    message: "当前图片变换暂不支持翻译"
                })
                return
            }
            if (action === "restored") {
                setState(prev => ({
                    ...prev,
                    buttonVisible: false,
                    currentTarget: null
                }))
                Toast.show({ type: ToastType.SUCCESS, message: "已恢复原图" })
                return
            }

            setState(prev => ({
                ...prev,
                translating: false
            }))

            Toast.show({
                type: ToastType.SUCCESS,
                message:
                    target instanceof HTMLCanvasElement
                        ? "Canvas 翻译成功"
                        : "图片翻译成功"
            })
        } catch (error) {
            console.error("[ImageTranslate] 翻译失败:", error)
            setState(prev => ({
                ...prev,
                translating: false
            }))

            Toast.show({
                type: ToastType.ERROR,
                message: error instanceof Error ? error.message : "图片翻译失败"
            })
        }
    }, [
        state.currentTarget,
        state.translating,
        config.targetLanguage,
        config.imageTranslationModelId,
        getCanvasMetaForTranslate
    ])

    // 监听图片悬浮事件
    useEffect(() => {
        if (!imageTranslationEnabled) {
            return
        }

        ensureCanvasHookInjected(window.location.href).catch(error => {
            console.warn("[ImageTranslate] Canvas hook 注入失败:", error)
        })

        document.addEventListener("mouseover", handleImageHover)
        document.addEventListener("mouseout", handleMouseLeave)

        return () => {
            document.removeEventListener("mouseover", handleImageHover)
            document.removeEventListener("mouseout", handleMouseLeave)
        }
    }, [imageTranslationEnabled, handleImageHover, handleMouseLeave])

    // 监听滚动事件，更新按钮位置
    useEffect(() => {
        if (!state.buttonVisible || !state.currentTarget) {
            return
        }

        const handleScroll = () => {
            const target = currentTargetRef.current
            if (target) {
                const position = calculateButtonPosition(target)
                setState(prev => ({
                    ...prev,
                    buttonPosition: position
                }))
            }
        }

        window.addEventListener("scroll", handleScroll, true)
        window.addEventListener("resize", handleScroll)
        return () => {
            window.removeEventListener("scroll", handleScroll, true)
            window.removeEventListener("resize", handleScroll)
        }
    }, [state.buttonVisible, state.currentTarget, calculateButtonPosition])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    useEffect(() => {
        return () => {
            clearHideTimeout()
            controllerRef.current?.destroyAll()
        }
    }, [clearHideTimeout])

    useEffect(() => {
        if (imageTranslationEnabled) {
            return
        }
        clearHideTimeout()
        controllerRef.current?.destroyAll()
        setState(prev => ({
            ...prev,
            translating: false,
            buttonVisible: false,
            currentTarget: null
        }))
    }, [clearHideTimeout, imageTranslationEnabled])

    if (!imageTranslationEnabled) {
        return null
    }

    return (
        <ImageTranslateButton
            visible={state.buttonVisible}
            translating={state.translating}
            onClick={handleTranslateClick}
            position={state.buttonPosition}
            onMouseEnter={() => {
                clearHideTimeout()
            }}
            onMouseLeave={() => {
                setState(prev => {
                    if (prev.translating) {
                        return prev
                    }
                    return {
                        ...prev,
                        buttonVisible: false,
                        currentTarget: null
                    }
                })
            }}
        />
    )
}

// 导出组件
export default function ImageTranslateContent() {
    const shadowHost = document.getElementById(getShadowHostId())
    if (!shadowHost?.shadowRoot) {
        return null
    }

    return (
        <StyleSheetManager
            target={shadowHost.shadowRoot as unknown as HTMLElement}
        >
            <div id={extensionShadowRootContainerId}>
                <ImageTranslate />
            </div>
        </StyleSheetManager>
    )
}
