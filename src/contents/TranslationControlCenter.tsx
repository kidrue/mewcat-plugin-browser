import { useAtom } from "jotai"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAsync, useAsyncFn, useClickAway, useLatest } from "react-use"
import styled, { StyleSheetManager } from "styled-components"

import { captureExtensionException } from "@/monitoring"

import BrandLogo from "../components/BrandLogo"
import Icon from "../components/Icon"
import SettingsPanel from "../components/SettingsPanel"
import Tooltip from "../components/Tooltip"
import { useDrag } from "../hooks/useDrag"
import { configAtom } from "../state"
import { ImmersiveTranslator } from "../translation/ImmersiveTranslator"
import { Toast, ToastType } from "../utils/toast"

import "@/styles/theme.scss"

export const getShadowHostId = () => "translation-control-center-overlay"

const SCxContainer = styled.div.withConfig({
    shouldForwardProp: prop => !(prop === "isDragging")
})<{
    x: number
    y: number
    isDragging: boolean
    $expanded: boolean
    $right: boolean
}>`
    position: fixed;
    left: ${({ x }) => x}px;
    top: ${({ y }) => y}px;
    width: 54px;
    height: 54px;
    --mewcat-expanded-offset: ${({ $right }) => ($right ? "-24px" : "24px")};
    transform: ${({ $expanded, isDragging, $right }) =>
        isDragging
            ? "translateX(0)"
            : $expanded
              ? "translateX(var(--mewcat-expanded-offset))"
              : `translateX(${$right ? "50%" : "-50%"})`};
    z-index: 99999;
    visibility: visible;
    cursor: ${props => (props.isDragging ? "grabbing" : "grab")};
    transition: ${props => (props.isDragging ? "none" : "all 0.3s ease")};
    &:hover,
    &:focus-within {
        transform: ${({ isDragging }) =>
            isDragging
                ? "translateX(0)"
                : "translateX(var(--mewcat-expanded-offset))"};
    }
    /* Keep the hover area connected to the edge while the button moves inward. */
    &::before {
        content: "";
        position: absolute;
        top: 0;
        ${({ $right }) => ($right ? "right: -12px" : "left: -12px")};
        width: ${({ $expanded, isDragging }) =>
            $expanded && !isDragging ? "12px" : "0"};
        height: 100%;
    }
    &:hover::before,
    &:focus-within::before {
        width: ${({ isDragging }) => (isDragging ? "0" : "12px")};
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`

const SCxFloatingButton = styled.div`
    position: relative;
    width: 54px;
    height: 54px;
    border-radius: var(--radius-xl);
    padding: 2px;
    box-sizing: border-box;
    overflow: visible;
    background: rgba(255, 255, 255, 0.94);
    box-shadow:
        0 0 0 1px var(--sky-line),
        var(--shadow-primary);
    opacity: 0.5;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
        opacity var(--transition-base, 0.2s ease),
        transform var(--transition-base, 0.2s ease);
    user-select: none;

    ${SCxContainer}:hover &, ${SCxContainer}:focus-within & {
        opacity: 1;
    }

    &:active {
        transform: scale(0.96);
    }
`

const SCxBrandLogo = styled(BrandLogo)`
    border-radius: calc(var(--radius-xl, 16px) - 2px);
`

// 研墨：翻译进行中，外沿一圈虚线缓慢转动
const SCxGrindRing = styled.div<{ $active: boolean }>`
    position: absolute;
    inset: -7px;
    border: 1.5px dashed var(--primary-muted);
    border-radius: calc(var(--radius-xl, 16px) + 4px);
    pointer-events: none;
    opacity: ${p => (p.$active ? 0.75 : 0)};
    transition: opacity var(--transition-base, 0.2s ease);
    animation: ${p => (p.$active ? "mewcat-grind 5s linear infinite" : "none")};

    @keyframes mewcat-grind {
        to {
            transform: rotate(360deg);
        }
    }

    /* 降级后停转，但形态保留 —— 状态仍然可辨认 */
    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`

// 落印：译文落定的一瞬，墨渍向外扩散一次
const SCxInkWash = styled.div<{ $active: boolean }>`
    position: absolute;
    inset: 0;
    border-radius: var(--radius-xl);
    background: rgba(126, 190, 235, 0.72);
    pointer-events: none;
    opacity: 0;
    ${p => p.$active && `animation: mewcat-wash 0.62s ease-out 1;`}

    @keyframes mewcat-wash {
        from {
            opacity: 0.42;
            transform: scale(1);
        }
        to {
            opacity: 0;
            transform: scale(1.85);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`

// 已落印的持久标记 —— 动画结束后状态依然可读
const SCxTickIcon = styled.div`
    position: absolute;
    right: -5px;
    bottom: -5px;
    z-index: 1;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--success);
    border-radius: var(--radius-sm);
    box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.9);
`

const SCxSettingsIcon = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "visible"
})<{ visible: boolean }>`
    position: absolute;
    bottom: -44px;
    left: 50%;
    transform: translateX(-50%);
    width: 30px;
    height: 30px;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
        opacity var(--transition-base, 0.2s ease),
        border-color var(--transition-base, 0.2s ease),
        background var(--transition-base, 0.2s ease);
    opacity: ${props => (props.visible ? 1 : 0)};
    visibility: ${props => (props.visible ? "visible" : "hidden")};
    pointer-events: ${props => (props.visible ? "auto" : "none")};

    &:hover {
        background: var(--primary-light);
        border-color: var(--primary-color);

        svg {
            color: var(--primary-color);
        }
    }

    svg {
        width: 16px;
        height: 16px;
        color: var(--text-tertiary);
        transition: color var(--transition-base, 0.2s ease);
    }

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
`

const SCxRefreshIcon = styled.button<{ $visible: boolean }>`
    position: absolute;
    top: -44px;
    left: 50%;
    transform: translateX(-50%);
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
        opacity var(--transition-base, 0.2s ease),
        border-color var(--transition-base, 0.2s ease),
        background var(--transition-base, 0.2s ease);
    opacity: ${props => (props.$visible ? 1 : 0)};
    visibility: ${props => (props.$visible ? "visible" : "hidden")};
    pointer-events: ${props => (props.$visible ? "auto" : "none")};

    &:hover:not(:disabled) {
        background: var(--primary-light);
        border-color: var(--primary-color);

        svg {
            color: var(--primary-color);
        }
    }

    &:disabled {
        cursor: wait;
        opacity: 0.6;
    }

    svg {
        color: var(--text-tertiary);
        transition: color var(--transition-base, 0.2s ease);
    }
`

const SCxSettingsPanel = styled.div.withConfig({
    shouldForwardProp: prop =>
        !["visible", "alignRight", "alignBottom"].includes(prop)
})<{
    visible: boolean
    alignRight: boolean
    alignBottom: boolean
}>`
    position: absolute;
    ${props => (props.alignBottom ? "bottom: 0" : "top: 0")};
    ${props => (props.alignRight ? "right: 70px" : "left: 70px")};
    opacity: ${props => (props.visible ? 1 : 0)};
    visibility: ${props => (props.visible ? "visible" : "hidden")};
    transform: ${props => (props.visible ? "scale(1)" : "scale(0.95)")};
    transition: all 0.3s ease;
    pointer-events: ${props => (props.visible ? "auto" : "none")};
    z-index: 10000;

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`
const TranslationControlCenter: React.FunctionComponent = () => {
    const [config] = useAtom(configAtom)
    const configRef = useLatest(config)
    const locationHrefRef = useRef(window.location.href)
    const autoTranslateDelayRef = useLatest(config.autoTranslateDelay)

    const { ref, position, isDragging, isDragged } = useDrag()

    const isAlwayTranslateSite = useMemo(
        () => config.alwaysTranslateUrls?.includes(window.location.hostname),
        [config.alwaysTranslateUrls]
    )

    const immersiveTranslatorRef = useRef<ImmersiveTranslator | null>(null)
    const [isTranslate, setIsTranslate] = React.useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [showSettingsIcon, setShowSettingsIcon] = useState(false)
    const [showSettingsPanel, setShowSettingsPanel] = useState(false)
    const [currentTabUrl, setCurrentTabUrl] = useState<URL | undefined>()
    const hideIconTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isTranslateRef = useLatest(isTranslate)

    // 获取当前标签页 URL
    useEffect(() => {
        setCurrentTabUrl(
            window.location.href ? new URL(window.location.href) : undefined
        )
    }, [])

    // 判断面板应该显示在左侧还是右侧
    const alignRight = useMemo(() => {
        return position.x > window.innerWidth / 2
    }, [position.x])

    // 判断面板应该向上还是向下显示
    const alignBottom = useMemo(() => {
        // 设置面板的大概高度（根据实际内容调整）
        const panelHeight = 600
        const buttonHeight = 56
        const availableSpaceBelow =
            window.innerHeight - position.y - buttonHeight
        const availableSpaceAbove = position.y

        // 如果下方空间不足以显示完整面板，且上方空间更充足，则向上显示
        if (
            availableSpaceBelow < panelHeight &&
            availableSpaceAbove > availableSpaceBelow
        ) {
            return true
        }
        return false
    }, [position.y])

    // 使用 useClickAway 检测点击外部区域
    useClickAway(ref, e => {
        const rootElement = document.querySelector(`#${getShadowHostId()}`)
        if (rootElement && rootElement.contains(e.target as Node)) {
            return
        }
        if (showSettingsPanel || showSettingsIcon) {
            setShowSettingsPanel(false)
            setShowSettingsIcon(false)
        }
    })

    // 清理定时器
    useEffect(() => {
        return () => {
            if (hideIconTimerRef.current) {
                clearTimeout(hideIconTimerRef.current)
            }
        }
    }, [])

    // 处理鼠标进入容器
    const handleMouseEnter = useCallback(() => {
        if (hideIconTimerRef.current) {
            clearTimeout(hideIconTimerRef.current)
            hideIconTimerRef.current = null
        }
        setShowSettingsIcon(true)
    }, [])

    // 处理鼠标离开容器
    const handleMouseLeave = useCallback(() => {
        if (!showSettingsPanel) {
            // 延迟隐藏，给用户时间移动到设置图标
            hideIconTimerRef.current = setTimeout(() => {
                setShowSettingsIcon(false)
            }, 200)
        }
    }, [showSettingsPanel])

    // 处理设置图标鼠标进入
    const handleSettingsIconMouseEnter = useCallback(() => {
        if (hideIconTimerRef.current) {
            clearTimeout(hideIconTimerRef.current)
            hideIconTimerRef.current = null
        }
        setShowSettingsIcon(true)
    }, [])

    // 开始翻译任务
    const [{ loading }, doTranslate] = useAsyncFn(async () => {
        const immersiveTranslator = immersiveTranslatorRef.current
        if (!immersiveTranslator) {
            console.error("ImmersiveTranslator not initialized")
            return false
        }

        try {
            setIsTranslate(true)
            const res = await immersiveTranslator.startImmersiveTranslation()
            return res
        } catch (err) {
            captureExtensionException(err, {
                feature: "page-translation",
                operation: "translate",
                pageUrl: location.href
            })
            console.error("Translation failed:", err)
            setIsTranslate(false)
            return false
        }
    }, [])

    const onClearTranslate = useCallback(() => {
        if (immersiveTranslatorRef.current) {
            immersiveTranslatorRef.current.clearAllTranslations()
            setIsTranslate(false)
        }
        chrome.runtime.sendMessage({
            type: "TRANSLATE_END",
            isTranslate: false
        })
    }, [])

    const onToggleTranslate = useCallback(async () => {
        if (isDragged.current || refreshing) {
            return
        }
        if (loading || isTranslateRef.current) {
            onClearTranslate()
            return
        }

        return doTranslate()
    }, [
        doTranslate,
        isDragged,
        isTranslateRef,
        loading,
        onClearTranslate,
        refreshing
    ])

    const onRefreshTranslate = useCallback(
        async (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            const immersiveTranslator = immersiveTranslatorRef.current
            if (!immersiveTranslator || refreshing) {
                return
            }

            setRefreshing(true)
            try {
                await immersiveTranslator.clearCurrentPageTranslationCache()
                immersiveTranslator.clearAllTranslations()
                setIsTranslate(false)

                const translated = await doTranslate()
                if (!translated) {
                    setIsTranslate(false)
                    Toast.show({
                        type: ToastType.ERROR,
                        message: "刷新翻译失败，请稍后重试"
                    })
                    return
                }

                Toast.show({
                    type: ToastType.SUCCESS,
                    message: "已刷新当前页面翻译"
                })
            } catch (error) {
                captureExtensionException(error, {
                    feature: "page-translation",
                    operation: "refresh",
                    pageUrl: location.href
                })
                console.error("刷新当前页面翻译失败:", error)
                Toast.show({
                    type: ToastType.ERROR,
                    message: "刷新翻译失败，请稍后重试"
                })
            } finally {
                setRefreshing(false)
            }
        },
        [doTranslate, refreshing]
    )

    const onToggleTranslateRef = useLatest(onToggleTranslate)

    // 初始化 ImmersiveTranslator
    useEffect(() => {
        immersiveTranslatorRef.current = new ImmersiveTranslator({
            ...configRef.current,
            prioritizeVisibleArea: true,
            debug: true
        })

        return () => {
            if (immersiveTranslatorRef.current) {
                immersiveTranslatorRef.current.clearAllTranslations()
                immersiveTranslatorRef.current = null
            }
        }
    }, [configRef])

    // 监听来自background的右键菜单消息。右键翻译或关闭
    useEffect(() => {
        const handleMessage = async (
            message: { type: string; targetLanguage?: string; text?: string },
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response: {
                error?: string
                isTranslate?: boolean
            }) => void
        ) => {
            if (message.type === "TOGGLE_IMMERSIVE_TRANSLATE") {
                sendResponse({ isTranslate })
                onToggleTranslateRef.current()
            }
            return true
        }
        chrome.runtime.onMessage.addListener(handleMessage)

        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage)
        }
    }, [onToggleTranslateRef, isTranslate])

    // 监听来自background的获取翻译状态的消息
    useEffect(() => {
        const handleMessage = function (
            message: { type: string; tabId?: string; text?: string },
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response: {
                error?: string
                isTranslate?: boolean
            }) => void
        ) {
            if (message.type === "GET_TRANSLATE_STATE") {
                sendResponse({ isTranslate })
            }
        }
        chrome.runtime.onMessage.addListener(handleMessage)
        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage)
        }
    }, [isTranslate])

    // 监听配置变化（包括模型切换）
    const prevModelRef = useRef(config.currentModel)
    useAsync(async () => {
        // 检测模型是否切换
        const modelChanged = prevModelRef.current !== config.currentModel
        prevModelRef.current = config.currentModel

        if (immersiveTranslatorRef.current) {
            await immersiveTranslatorRef.current.updateConfig({
                ...config,
                prioritizeVisibleArea: true
            })

            // 如果模型切换且当前正在翻译，清空翻译并重新翻译
            if (modelChanged && isTranslateRef.current) {
                console.log(
                    "🔄 [TranslationControlCenter] 检测到模型切换，重新翻译页面"
                )
                // 先清空当前翻译
                immersiveTranslatorRef.current.clearAllTranslations()

                // 延迟一小段时间后重新翻译，确保清理完成
                setTimeout(async () => {
                    await doTranslate()
                }, 300)
            }
        }
    }, [config, doTranslate])

    //自动翻译 -- start
    useEffect(() => {
        let timer = null

        if (
            (document.readyState === "interactive" ||
                document.readyState === "complete") &&
            isAlwayTranslateSite
        ) {
            timer = setTimeout(() => {
                doTranslate()
            }, autoTranslateDelayRef.current)
        }

        return () => {
            clearTimeout(timer)
        }
    }, [autoTranslateDelayRef, doTranslate, isAlwayTranslateSite])

    // 监听url变化自动翻译
    useEffect(() => {
        let timer = null
        const handleMessage = async (message: {
            type: string
            targetLanguage?: string
            text?: string
        }) => {
            if (message.type === "TAB_UPDATED") {
                const href = window.location.href
                if (locationHrefRef.current !== href && isAlwayTranslateSite) {
                    timer = setTimeout(async () => {
                        locationHrefRef.current = window.location.href
                        await doTranslate()
                    }, autoTranslateDelayRef.current)
                }
                return
            }
        }
        chrome.runtime.onMessage.addListener(handleMessage)

        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage)
            clearTimeout(timer)
        }
    }, [autoTranslateDelayRef, isAlwayTranslateSite, doTranslate])

    // 自动翻译 -- end
    const getRootElement = () =>
        (document.querySelector(`#${getShadowHostId()}`)?.shadowRoot ??
            undefined) as unknown as HTMLElement | undefined

    return (
        <StyleSheetManager target={getRootElement()}>
            <SCxContainer
                ref={ref}
                x={position.x}
                y={position.y}
                isDragging={isDragging}
                $expanded={showSettingsIcon || showSettingsPanel || isDragging}
                $right={alignRight}
                onClick={onToggleTranslate}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {(loading || isTranslate) && (
                    <SCxRefreshIcon
                        type="button"
                        $visible={showSettingsIcon}
                        disabled={refreshing}
                        aria-label="清除当前页缓存并重新翻译"
                        title={
                            refreshing
                                ? "正在刷新翻译"
                                : "清除当前页缓存并重新翻译"
                        }
                        onClick={onRefreshTranslate}
                        onMouseEnter={handleSettingsIconMouseEnter}
                    >
                        <Icon name="refresh" size={16} />
                    </SCxRefreshIcon>
                )}

                <Tooltip
                    content={
                        refreshing
                            ? "正在刷新翻译"
                            : loading || isTranslate
                              ? "清理翻译"
                              : "开启翻译"
                    }
                    position={alignRight ? "left" : "right"}
                    trigger="hover"
                    disabled={isDragging}
                >
                    <SCxFloatingButton
                        data-mewcat-drag-handle
                        role="button"
                        tabIndex={0}
                        onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                isDragged.current = false
                                event.currentTarget.click()
                            }
                        }}
                        aria-label={
                            loading
                                ? "翻译中"
                                : isTranslate
                                  ? "清理翻译"
                                  : "开启翻译"
                        }
                    >
                        <SCxGrindRing $active={loading} aria-hidden="true" />
                        <SCxInkWash
                            key={isTranslate ? "washed" : "idle"}
                            $active={isTranslate && !loading}
                            aria-hidden="true"
                        />
                        <SCxBrandLogo size={50} />

                        {isTranslate && (
                            <SCxTickIcon>
                                <Icon
                                    name={"check"}
                                    size={12}
                                    color="#ffffff"
                                />
                            </SCxTickIcon>
                        )}
                    </SCxFloatingButton>
                </Tooltip>

                <SCxSettingsIcon
                    visible={showSettingsIcon}
                    role="button"
                    tabIndex={showSettingsIcon ? 0 : -1}
                    aria-label="打开高级设置"
                    onClick={e => {
                        e.stopPropagation()
                        setShowSettingsPanel(!showSettingsPanel)
                    }}
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowSettingsPanel(!showSettingsPanel)
                        }
                    }}
                    onMouseEnter={handleSettingsIconMouseEnter}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </SCxSettingsIcon>

                <SCxSettingsPanel
                    visible={showSettingsPanel}
                    alignRight={alignRight}
                    alignBottom={alignBottom}
                    onClick={e => e.stopPropagation()}
                >
                    <SettingsPanel currentTabUrl={currentTabUrl} />
                </SCxSettingsPanel>
            </SCxContainer>
        </StyleSheetManager>
    )
}

export default TranslationControlCenter
