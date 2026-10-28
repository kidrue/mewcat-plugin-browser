import { useAtom } from "jotai"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useClickAway, useLatest } from "react-use"
import styled, { StyleSheetManager } from "styled-components"

import { languages } from "@/constants"
import { captureExtensionException } from "@/monitoring"
import {
    readingStatus,
    type PageActionRequest,
    type ReadingState
} from "@/reading/pageActions"

import BrandLogo from "../components/BrandLogo"
import Icon from "../components/Icon"
import Tooltip from "../components/Tooltip"
import { useDrag } from "../hooks/useDrag"
import { configAtom } from "../state"
import { ImmersiveTranslator } from "../translation/ImmersiveTranslator"
import {
    DEFAULT_PARAGRAPH_SHORTCUT,
    installParagraphShortcut
} from "../translation/paragraphShortcut"
import { detectPageLanguage } from "../utils/detectPageLanguage"
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

const SCxActions = styled.div<{ $visible: boolean }>`
    position: absolute;
    bottom: -44px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    opacity: ${props => (props.$visible ? 1 : 0)};
    visibility: ${props => (props.$visible ? "visible" : "hidden")};
    pointer-events: ${props => (props.$visible ? "auto" : "none")};
    transition: opacity var(--transition-base, 0.2s ease);
`

const SCxActionButton = styled.button`
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
    const pageSession = useRef({
        active: false,
        busy: false,
        source: "auto",
        detectedSource: undefined as string | undefined,
        paused: false,
        generation: 0,
        reason: ""
    })
    const resolveSourceLanguage = useCallback(() => {
        if (pageSession.current.source !== "auto") {
            return pageSession.current.source
        }
        // 翻译期间保留原文语言；未翻译时允许异步加载的正文更新检测结果。
        if (!pageSession.current.active) {
            pageSession.current.detectedSource = detectPageLanguage()
        }
        return pageSession.current.detectedSource ?? "auto"
    }, [])
    const [isTranslate, setIsTranslate] = React.useState(false)
    const [loading, setLoading] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const refreshTask = useRef(0)
    const [showActions, setShowActions] = useState(false)
    const hideIconTimerRef = useRef<NodeJS.Timeout | null>(null)

    // 判断面板应该显示在左侧还是右侧
    const alignRight = useMemo(() => {
        return position.x > window.innerWidth / 2
    }, [position.x])

    // 使用 useClickAway 检测点击外部区域
    useClickAway(ref, e => {
        const rootElement = document.querySelector(`#${getShadowHostId()}`)
        if (rootElement && rootElement.contains(e.target as Node)) {
            return
        }
        if (showActions) {
            setShowActions(false)
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
        setShowActions(true)
    }, [])

    // 处理鼠标离开容器
    const handleMouseLeave = useCallback(() => {
        // 延迟隐藏，给用户时间移动到下方入口。
        hideIconTimerRef.current = setTimeout(() => {
            setShowActions(false)
        }, 200)
    }, [])

    const openExtensionPage = (type: "OPEN_SIDE_PANEL" | "OPEN_OPTIONS") => {
        const fail = (message = "无法连接扩展，请刷新网页后重试。") =>
            Toast.show({ type: ToastType.ERROR, message })
        try {
            chrome.runtime.sendMessage(
                { type },
                (response?: { success: boolean; message?: string }) => {
                    if (chrome.runtime.lastError || !response?.success) {
                        fail(response?.message)
                    }
                }
            )
        } catch {
            fail()
        }
    }

    // 开始翻译任务
    const doTranslate = useCallback(
        async (manual = false) => {
            const immersiveTranslator = immersiveTranslatorRef.current
            if (!immersiveTranslator) {
                console.error("ImmersiveTranslator not initialized")
                return false
            }

            if (pageSession.current.busy) return true
            const sourceLanguage = resolveSourceLanguage()
            const generation = ++pageSession.current.generation
            pageSession.current.active = true
            pageSession.current.busy = true
            pageSession.current.reason = ""
            immersiveTranslator.setSourceLanguage(sourceLanguage)
            try {
                setIsTranslate(true)
                const res = await immersiveTranslator.startImmersiveTranslation(
                    {
                        manual
                    }
                )
                if (!res && generation === pageSession.current.generation) {
                    pageSession.current.active = false
                    pageSession.current.reason =
                        "未开始翻译，请检查网站规则或页面是否有可翻译内容。"
                    setIsTranslate(false)
                }
                return res
            } catch (err) {
                captureExtensionException(err, {
                    feature: "page-translation",
                    operation: "translate",
                    pageUrl: location.href
                })
                console.error("Translation failed:", err)
                if (generation === pageSession.current.generation) {
                    pageSession.current.active = false
                    pageSession.current.reason =
                        "翻译失败，请重试或切换翻译服务。"
                    setIsTranslate(false)
                }
                return false
            } finally {
                if (generation === pageSession.current.generation) {
                    pageSession.current.busy = false
                }
            }
        },
        [resolveSourceLanguage]
    )

    const onClearTranslate = useCallback((preserveRefresh = false) => {
        if (!preserveRefresh) {
            refreshTask.current++
            setRefreshing(false)
        }
        pageSession.current.generation++
        pageSession.current.active = false
        pageSession.current.busy = false
        pageSession.current.paused = true
        pageSession.current.reason = ""
        setLoading(false)
        if (immersiveTranslatorRef.current) {
            immersiveTranslatorRef.current.clearAllTranslations()
            setIsTranslate(false)
        }
    }, [])

    useEffect(() => {
        chrome.runtime.sendMessage(
            { type: "TRANSLATE_END", isTranslate },
            () => {
                void chrome.runtime.lastError
            }
        )
    }, [isTranslate])

    const onToggleTranslate = useCallback(async () => {
        if (isDragged.current || refreshing) {
            return
        }
        if (pageSession.current.active) {
            onClearTranslate()
            return
        }

        pageSession.current.paused = false
        return doTranslate(true)
    }, [doTranslate, isDragged, onClearTranslate, refreshing])

    const onRefreshTranslate = useCallback(
        async (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            const immersiveTranslator = immersiveTranslatorRef.current
            if (!immersiveTranslator || refreshing) {
                return
            }

            setRefreshing(true)
            const refresh = ++refreshTask.current
            let generation = pageSession.current.generation
            try {
                await immersiveTranslator.clearCurrentPageTranslationCache()
                if (pageSession.current.generation !== generation) {
                    return
                }
                if (immersiveTranslator.getTranslationScope() === "paragraph") {
                    await immersiveTranslator.restartParagraphTranslations()
                    return
                }
                onClearTranslate(true)
                pageSession.current.paused = false

                const task = doTranslate(true)
                generation = pageSession.current.generation
                const translated = await task
                if (pageSession.current.generation !== generation) {
                    return
                }
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
                if (pageSession.current.generation !== generation) {
                    return
                }
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
                if (refreshTask.current === refresh) {
                    setRefreshing(false)
                }
            }
        },
        [doTranslate, refreshing, onClearTranslate]
    )

    const onToggleTranslateRef = useLatest(onToggleTranslate)
    const executePageAction = useCallback(
        async (request: PageActionRequest): Promise<ReadingState> => {
            const engine = immersiveTranslatorRef.current
            if (
                !engine ||
                (request.pageUrl && request.pageUrl !== location.href)
            )
                return {
                    status: "unavailable",
                    translated: 0,
                    failed: 0,
                    reason: "页面已变化，请重新打开翻译面板。"
                }
            if (request.action === "clear") onClearTranslate()
            if (
                request.action === "start" &&
                (!pageSession.current.active ||
                    engine.getTranslationScope() === "paragraph")
            ) {
                pageSession.current.paused = false
                void doTranslate(true)
            }
            if (request.action === "retry")
                void engine.retryFailedTranslations().catch(() => {
                    pageSession.current.reason = "重试失败，请稍后再试。"
                })
            if (
                request.action === "source" &&
                (request.sourceLanguage === "auto" ||
                    languages.languages.some(
                        item => item.value === request.sourceLanguage
                    ))
            ) {
                const active = pageSession.current.active
                const paragraph =
                    active && engine.getTranslationScope() === "paragraph"
                if (!paragraph) onClearTranslate()
                pageSession.current.source = request.sourceLanguage!
                if (request.sourceLanguage === "auto") {
                    pageSession.current.detectedSource = undefined
                }
                engine.setSourceLanguage(resolveSourceLanguage())
                if (active) {
                    pageSession.current.paused = false
                    if (paragraph)
                        void engine.restartParagraphTranslations().catch(() => {
                            pageSession.current.reason =
                                "段落翻译失败，请重试。"
                        })
                    else void doTranslate(true)
                }
            }
            const progress = engine.getReadingProgress()
            return {
                ...readingStatus(
                    pageSession.current.active,
                    pageSession.current.busy || progress.busy,
                    progress.translated,
                    progress.failed
                ),
                sourceLanguage: resolveSourceLanguage(),
                reason: pageSession.current.reason
            }
        },
        [doTranslate, onClearTranslate, resolveSourceLanguage]
    )
    const executePageActionRef = useLatest(executePageAction)
    useEffect(() => {
        const listener = (
            request: PageActionRequest,
            _sender: chrome.runtime.MessageSender,
            respond: (state: ReadingState) => void
        ) => {
            if (request.type !== "MEWCAT_PAGE_ACTION") return
            void executePageActionRef
                .current(request)
                .then(respond)
                .catch(() =>
                    respond({
                        status: "unavailable",
                        translated: 0,
                        failed: 0,
                        reason: "操作失败，请重试。"
                    })
                )
            return true
        }
        chrome.runtime.onMessage.addListener(listener)
        return () => chrome.runtime.onMessage.removeListener(listener)
    }, [executePageActionRef])

    // 初始化 ImmersiveTranslator
    useEffect(() => {
        let mounted = true
        immersiveTranslatorRef.current = new ImmersiveTranslator({
            ...configRef.current,
            onRequestStateChange: active => {
                if (mounted) {
                    setLoading(active)
                }
            },
            prioritizeVisibleArea: true,
            debug: true
        })

        return () => {
            mounted = false
            if (immersiveTranslatorRef.current) {
                immersiveTranslatorRef.current.clearAllTranslations()
                immersiveTranslatorRef.current = null
            }
        }
    }, [configRef])

    // 监听来自background的右键菜单消息。右键翻译或关闭
    useEffect(() => {
        const handleMessage = (
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
            return
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
    const settingsKey = JSON.stringify({
        currentModel: config.currentModel,
        targetLanguage: config.targetLanguage,
        aiRole: config.aiRole,
        enableThinking: config.enableThinking,
        enableContext: config.enableContext,
        model: config.aiModelList.find(
            model => model.id === config.currentModel
        )
    })
    const previousSettingsKey = useRef(settingsKey)
    useEffect(() => {
        if (
            config.extensionEnabled === false ||
            config.enableParagraphTranslation === false
        )
            return
        return installParagraphShortcut(
            config.paragraphTranslationShortcut ?? DEFAULT_PARAGRAPH_SHORTCUT,
            target => {
                const engine = immersiveTranslatorRef.current
                if (!engine || refreshing) return
                const generation = pageSession.current.generation
                engine.setSourceLanguage(resolveSourceLanguage())
                const wasActive = pageSession.current.active
                pageSession.current.active = true
                pageSession.current.paused = false
                setIsTranslate(true)
                void engine
                    .translateParagraph(target)
                    .then(translated => {
                        if (generation !== pageSession.current.generation)
                            return
                        if (
                            !translated &&
                            !wasActive &&
                            !engine.translationNodes.length
                        ) {
                            pageSession.current.active = false
                            setIsTranslate(false)
                        }
                    })
                    .catch(error => {
                        captureExtensionException(error, {
                            feature: "page-translation",
                            operation: "paragraph-translate",
                            pageUrl: location.href
                        })
                        Toast.show({
                            type: ToastType.ERROR,
                            message: "段落翻译失败，请重试或切换翻译服务"
                        })
                    })
            }
        )
    }, [
        config.extensionEnabled,
        config.enableParagraphTranslation,
        config.paragraphTranslationShortcut,
        refreshing,
        resolveSourceLanguage
    ])
    useEffect(() => {
        const engine = immersiveTranslatorRef.current
        const restart =
            engine?.getTranslationScope() === "page" &&
            previousSettingsKey.current !== settingsKey &&
            pageSession.current.active &&
            !pageSession.current.paused
        previousSettingsKey.current = settingsKey
        if (!engine) {
            return
        }
        if (restart) {
            onClearTranslate()
            pageSession.current.paused = false
        }
        const generation = pageSession.current.generation
        let active = true
        void engine
            .updateConfig({ ...config, prioritizeVisibleArea: true })
            .then(() => {
                if (
                    active &&
                    restart &&
                    generation === pageSession.current.generation &&
                    !pageSession.current.paused
                ) {
                    void doTranslate(true)
                }
            })
            .catch(error => {
                if (active) {
                    pageSession.current.reason = "更新翻译设置失败，请重试。"
                }
                captureExtensionException(error, {
                    feature: "page-translation",
                    operation: "update-config",
                    pageUrl: location.href
                })
            })
        return () => {
            active = false
        }
    }, [config, settingsKey, doTranslate, onClearTranslate])

    //自动翻译 -- start
    useEffect(() => {
        let timer = null

        if (
            (document.readyState === "interactive" ||
                document.readyState === "complete") &&
            isAlwayTranslateSite
        ) {
            timer = setTimeout(() => {
                if (!pageSession.current.paused) doTranslate()
            }, autoTranslateDelayRef.current)
        }

        return () => {
            clearTimeout(timer)
        }
    }, [autoTranslateDelayRef, doTranslate, isAlwayTranslateSite])

    // 监听url变化自动翻译
    useEffect(() => {
        let timer = null
        const handleMessage = (message: {
            type: string
            targetLanguage?: string
            text?: string
        }) => {
            if (message.type === "TAB_UPDATED") {
                const href = window.location.href
                if (locationHrefRef.current === href) {
                    return
                }
                clearTimeout(timer)
                onClearTranslate()
                pageSession.current.source = "auto"
                pageSession.current.detectedSource = undefined
                pageSession.current.paused = false
                locationHrefRef.current = href
                if (isAlwayTranslateSite && !pageSession.current.paused) {
                    const generation = pageSession.current.generation
                    timer = setTimeout(async () => {
                        if (
                            pageSession.current.paused ||
                            pageSession.current.generation !== generation ||
                            window.location.href !== href
                        ) {
                            return
                        }
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
    }, [
        autoTranslateDelayRef,
        isAlwayTranslateSite,
        doTranslate,
        onClearTranslate
    ])

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
                $expanded={showActions || isDragging}
                $right={alignRight}
                onClick={onToggleTranslate}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {(loading || isTranslate) && (
                    <SCxRefreshIcon
                        type="button"
                        $visible={showActions}
                        disabled={refreshing}
                        aria-label="清除当前页缓存并重新翻译"
                        title={
                            refreshing
                                ? "正在刷新翻译"
                                : "清除当前页缓存并重新翻译"
                        }
                        onClick={onRefreshTranslate}
                        onMouseEnter={handleMouseEnter}
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

                <SCxActions
                    $visible={showActions}
                    onMouseEnter={handleMouseEnter}
                >
                    <SCxActionButton
                        type="button"
                        tabIndex={showActions ? 0 : -1}
                        aria-label="打开侧边栏"
                        title="打开侧边栏"
                        onClick={e => {
                            e.stopPropagation()
                            openExtensionPage("OPEN_SIDE_PANEL")
                        }}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                        >
                            <rect x="3" y="4" width="18" height="16" rx="2" />
                            <path d="M15 4v16" />
                        </svg>
                    </SCxActionButton>
                    <SCxActionButton
                        type="button"
                        tabIndex={showActions ? 0 : -1}
                        aria-label="进入高级设置"
                        title="进入高级设置"
                        onClick={e => {
                            e.stopPropagation()
                            openExtensionPage("OPEN_OPTIONS")
                        }}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </SCxActionButton>
                </SCxActions>
            </SCxContainer>
        </StyleSheetManager>
    )
}

export default TranslationControlCenter
