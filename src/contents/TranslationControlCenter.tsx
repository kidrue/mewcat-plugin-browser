import { useAtom } from "jotai"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAsync, useAsyncFn, useClickAway, useLatest } from "react-use"
import styled, { StyleSheetManager } from "styled-components"

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
})<{ x: number; y: number; isDragging: boolean }>`
    position: fixed;
    left: ${({ x }) => x || window.innerWidth - 80}px;
    top: ${({ y }) => (y ? `${y}px` : "calc(50% - 100px)")};
    z-index: 99999;
    visibility: visible;
    cursor: ${props => (props.isDragging ? "grabbing" : "grab")};
    transition: ${props => (props.isDragging ? "none" : "all 0.3s ease")};
`

const SCxFloatingButton = styled.div`
    position: relative;
    width: 54px;
    height: 54px;
    border-radius: var(--radius-xl);
    background: var(--primary-color, #b23a2e);
    /* 内描边 —— 印面的留白边 */
    box-shadow:
        inset 0 0 0 1.5px rgba(251, 248, 240, 0.6),
        0 3px 10px rgba(142, 42, 32, 0.24);
    opacity: 0.84;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
        opacity var(--transition-base, 0.2s ease),
        transform var(--transition-base, 0.2s ease);
    user-select: none;

    &:hover {
        opacity: 1;
        transform: translateY(-1px);
    }

    &:active {
        transform: translateY(0) scale(0.96);
    }
`

// 印文：一个「譯」字。用系统宋体，不依赖任何图片资源。
const SCxSealGlyph = styled.span`
    font-family: var(--font-display, serif);
    font-size: 27px;
    font-weight: 600;
    line-height: 1;
    color: var(--text-inverse, #fbf8f0);
    user-select: none;
    -webkit-user-drag: none;
`

// 研墨：翻译进行中，外沿一圈虚线缓慢转动
const SCxGrindRing = styled.div<{ $active: boolean }>`
    position: absolute;
    inset: -7px;
    border: 1.5px dashed var(--primary-color, #b23a2e);
    border-radius: calc(var(--radius-xl, 16px) + 4px);
    pointer-events: none;
    opacity: ${p => (p.$active ? 0.75 : 0)};
    transition: opacity var(--transition-base, 0.2s ease);
    animation: mewcat-grind 5s linear infinite;

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
    background: var(--primary-color, #b23a2e);
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
    background: var(--jade, #3e6b63);
    border-radius: var(--radius-sm);
    box-shadow: inset 0 0 0 1.5px rgba(251, 248, 240, 0.85);
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
    background: var(--bg-secondary, #fbf8f0);
    border: 1px solid var(--border-color, #d8d0be);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(26, 23, 20, 0.05));
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
        background: var(--primary-light, #f7efe6);
        border-color: var(--primary-color, #b23a2e);

        svg {
            color: var(--primary-color, #b23a2e);
        }
    }

    svg {
        width: 16px;
        height: 16px;
        color: var(--text-tertiary, #6e665c);
        transition: color var(--transition-base, 0.2s ease);
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
    background: var(--bg-secondary, #fbf8f0);
    border: 1px solid var(--border-color, #d8d0be);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(26, 23, 20, 0.05));
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
        background: var(--primary-light, #f7efe6);
        border-color: var(--primary-color, #b23a2e);

        svg {
            color: var(--primary-color, #b23a2e);
        }
    }

    &:disabled {
        cursor: wait;
        opacity: 0.6;
    }

    svg {
        color: var(--text-tertiary, #6e665c);
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
        if (loading || isTranslate) {
            onClearTranslate()
            return
        }

        return doTranslate()
    }, [
        doTranslate,
        isDragged,
        isTranslate,
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
            if (modelChanged && isTranslate) {
                console.log(
                    "🔄 [TranslationControlCenter] 检测到模型切换，重新翻译页面"
                )
                // 先清空当前翻译
                immersiveTranslatorRef.current.clearAllTranslations()
                setIsTranslate(false)

                // 延迟一小段时间后重新翻译，确保清理完成
                setTimeout(async () => {
                    await doTranslate()
                }, 300)
            }
        }
    }, [config, isTranslate, doTranslate])

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
                    position="left"
                    trigger="hover"
                    disabled={isDragging}
                >
                    <SCxFloatingButton
                        role="button"
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
                        <SCxSealGlyph aria-hidden="true">譯</SCxSealGlyph>

                        {isTranslate && (
                            <SCxTickIcon>
                                <Icon
                                    name={"check"}
                                    size={12}
                                    color="#fbf8f0"
                                />
                            </SCxTickIcon>
                        )}
                    </SCxFloatingButton>
                </Tooltip>

                <SCxSettingsIcon
                    visible={showSettingsIcon}
                    onClick={e => {
                        e.stopPropagation()
                        setShowSettingsPanel(!showSettingsPanel)
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
