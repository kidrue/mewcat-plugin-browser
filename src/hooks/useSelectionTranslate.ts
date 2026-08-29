import { useCallback, useEffect, useRef, useState } from "react"

import {
    calculatePosition,
    getSelectionContext,
    getSelectionSnapshot,
    hasSelectionChanged,
    isSelectionUiEvent
} from "@/utils/dom"
import type { SelectionSnapshot } from "@/utils/dom"

import type { ExtensionConfig } from "../types/config"

export interface SelectionState {
    text: string
    context: string
    position: {
        top: number
        left: number
    }
    textRect?: DOMRect
    isVisible: boolean
    isDotVisible: boolean
    triggerDot?: {
        x: number
        y: number
    }
}

export interface UseSelectionTranslateOptions {
    config: ExtensionConfig
}

/**
 * 划词翻译 Hook
 * 根据配置处理不同的触发模式和交互方式
 */
export function useSelectionTranslate<T extends HTMLElement>({
    config
}: UseSelectionTranslateOptions) {
    const triggerMode = config.selectionTriggerMode
    const dotRef = useRef<T>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const ignoreMouseUpRef = useRef(false)
    const selectionAtMouseDownRef = useRef<SelectionSnapshot | null>(null)
    const [state, setState] = useState<SelectionState>({
        text: "",
        context: "",
        position: { top: 0, left: 0 },
        isVisible: false,
        isDotVisible: false
    })

    // 检查当前网站是否被禁用
    const isCurrentSiteDisabled = useCallback(() => {
        if (!config.selectionDisabledSites?.length) {
            return false
        }

        const currentUrl = window.location.href
        const currentHostname = window.location.hostname

        return config.selectionDisabledSites.some(site => {
            // 支持通配符匹配
            if (site.startsWith("*")) {
                const domain = site.substring(1)
                return currentHostname.endsWith(domain)
            }
            // 完整域名匹配
            if (site.includes(".")) {
                return (
                    currentHostname === site ||
                    currentHostname.endsWith("." + site)
                )
            }
            // URL包含匹配
            return currentUrl.includes(site)
        })
    }, [config.selectionDisabledSites])

    // 检查是否应该触发
    const shouldTrigger = useCallback(() => {
        // 检查是否启用
        if (!config.isSelectedTranslate) {
            return false
        }

        // 检查当前网站是否被禁用
        if (isCurrentSiteDisabled()) {
            return false
        }

        return true
    }, [config.isSelectedTranslate, isCurrentSiteDisabled])

    // 计算位置
    const computeRect = useCallback(() => {
        setState(prev => {
            const container = containerRef.current
            if (!prev.textRect || !container) {
                return prev
            }
            const position = calculatePosition(
                prev.textRect,
                container.getBoundingClientRect()
            )
            return {
                ...prev,
                position
            }
        })
    }, [])

    const settingSelection = useCallback(
        (snapshot?: SelectionSnapshot | null) => {
            snapshot ??= getSelectionSnapshot(window.getSelection())
            if (!snapshot || !containerRef.current) {
                return null
            }
            setState(prev => ({
                ...prev,
                text: snapshot.text,
                context: getSelectionContext(snapshot),
                textRect: snapshot.rect
            }))
            return snapshot.text
        },
        []
    )

    // 显示翻译面板
    const showTranslatePanel = useCallback(() => {
        if (!shouldTrigger()) {
            return
        }
        computeRect()
        setState(prev => {
            if (!prev.text || !prev.textRect) {
                return prev
            }
            return {
                ...prev,
                isVisible: true,
                isDotVisible: false
            }
        })
    }, [computeRect, shouldTrigger])

    // 显示触发点
    const showTriggerDot = useCallback((x: number, y: number) => {
        setState(prev => {
            return {
                ...prev,
                triggerDot: { x, y },
                isDotVisible: true,
                isVisible: false
            }
        })
    }, [])

    // 隐藏所有
    const hideAll = useCallback(() => {
        setState(prev => ({
            ...prev,
            text: "",
            context: "",
            textRect: undefined,
            position: { top: 0, left: 0 },
            isVisible: false,
            isDotVisible: false,
            triggerDot: undefined
        }))
    }, [])

    // 点击触发点
    const onDotClick = useCallback(() => {
        if (state.text) {
            showTranslatePanel()
        }
    }, [state.text, showTranslatePanel])

    // 悬停触发点
    const onDotHover = useCallback(() => {
        if (state.text && config.selectionInteractionMode === "hover") {
            showTranslatePanel()
        }
    }, [state.text, config.selectionInteractionMode, showTranslatePanel])

    // 监听键盘事件
    useEffect(() => {
        if (!config.isSelectedTranslate) {
            return
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            // 根据配置的触发模式检查对应的按键
            const triggerKeyText = e.key.toUpperCase()
            // 检查是否为精确的 Shift 触发
            const isShiftTrigger =
                triggerMode === "shift" && triggerKeyText === "SHIFT"

            // 检查是否为精确的 Ctrl 触发
            const isCtrlTrigger =
                triggerMode === "ctrl" &&
                ["CONTROL", "CTRL"].includes(triggerKeyText)

            // 如果既不是 Shift 触发，也不是 Ctrl 触发，则返回
            if (!(isShiftTrigger || isCtrlTrigger)) {
                return
            }
            showTranslatePanel()
        }
        document.addEventListener("keyup", handleKeyUp)

        return () => {
            document.removeEventListener("keyup", handleKeyUp)
        }
    }, [config.isSelectedTranslate, showTranslatePanel, triggerMode])

    // 监听鼠标事件
    useEffect(() => {
        if (!config.isSelectedTranslate) {
            return
        }
        const handleMouseDown = (e: MouseEvent) => {
            selectionAtMouseDownRef.current = getSelectionSnapshot(
                window.getSelection()
            )
            if (isSelectionUiEvent(e, [containerRef.current, dotRef.current])) {
                ignoreMouseUpRef.current = true
                return
            }
            ignoreMouseUpRef.current = false

            // 如果不是选择文本的操作，隐藏面板
            hideAll()
        }

        const handleMouseUp = (e: MouseEvent) => {
            if (ignoreMouseUpRef.current) {
                ignoreMouseUpRef.current = false
                selectionAtMouseDownRef.current = null
                return
            }

            const currentSelection = getSelectionSnapshot(window.getSelection())
            const selectionChanged = hasSelectionChanged(
                selectionAtMouseDownRef.current,
                currentSelection
            )
            selectionAtMouseDownRef.current = null
            if (!selectionChanged || !shouldTrigger()) {
                return
            }

            // 仅在本次鼠标操作产生新选区时计算位置
            const selectedText = settingSelection(currentSelection)
            if (selectedText) {
                // 判断类型决定是否打开
                triggerMode === "direct" && showTranslatePanel()
                triggerMode === "dot" && showTriggerDot(e.clientX, e.clientY)
            }
        }

        document.addEventListener("mousedown", handleMouseDown)
        document.addEventListener("mouseup", handleMouseUp)

        return () => {
            document.removeEventListener("mousedown", handleMouseDown)
            document.removeEventListener("mouseup", handleMouseUp)
        }
    }, [
        containerRef,
        showTranslatePanel,
        hideAll,
        settingSelection,
        showTriggerDot,
        triggerMode,
        shouldTrigger,
        config.isSelectedTranslate
    ])

    // 监听配置变化，清理与新配置不兼容的临时 UI
    useEffect(() => {
        if (!shouldTrigger()) {
            hideAll()
            return
        }
        if (triggerMode !== "dot") {
            setState(prev => {
                if (!prev.isDotVisible && !prev.triggerDot) {
                    return prev
                }
                return {
                    ...prev,
                    isDotVisible: false,
                    triggerDot: undefined
                }
            })
        }
    }, [hideAll, shouldTrigger, triggerMode])

    return {
        state,
        dotRef,
        containerRef,
        actions: {
            hideAll,
            onDotClick,
            onDotHover,
            showTranslatePanel,
            onComputeRect: computeRect
        },
        config: {
            isEnabled: config.isSelectedTranslate,
            triggerMode: config.selectionTriggerMode || "direct",
            interactionMode: config.selectionInteractionMode || "click",
            isCurrentSiteDisabled: isCurrentSiteDisabled()
        }
    }
}
