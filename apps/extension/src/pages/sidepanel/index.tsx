import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import styled from "styled-components"

import "@/styles/theme.scss"

import { AUTO_DETECT_OPTION, languages } from "@/constants"
import { MEWCAT_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import {
    getSelectedGenerativeModel,
    translateText
} from "@/features/translation-services"
import { useConfig } from "@/state/config"
import { AiRole } from "@/types/config"

import BrandLogo from "../../components/BrandLogo"
import LoadingDots from "../../components/LoadingDots"
import Select from "../../components/Select"
import { getSkySceneUrl, SkyMascot } from "../../components/SkyArtwork"
import TranslationMark from "../../components/TranslationMark"
import { TranslationRolePicker } from "../../components/TranslationRolePicker"

// ============================================
// Layout
// ============================================

const Container = styled.div`
    width: 100%;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background:
        linear-gradient(
            180deg,
            rgba(242, 248, 254, 0.48),
            rgba(242, 248, 254, 0.08) 85%
        ),
        url("${getSkySceneUrl("sidepanel")}") center bottom / cover no-repeat,
        var(--bg-primary);
    font-family: var(--font-family);
    color: var(--text-primary);
`

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--control-surface-bg);
    flex-shrink: 0;
    /* 信纸折痕 */
    position: relative;
    border-bottom: 1px solid var(--rule-strong);

    &::after {
        content: "";
        position: absolute;
        left: 0;
        bottom: -4px;
        width: 8px;
        height: 8px;
        background: var(--primary-color);
        border-radius: var(--radius-full);
    }
`

const HeaderLogo = styled(BrandLogo)`
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-primary-sm);
`

const HeaderTitle = styled.h1`
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.06em;
    color: var(--text-primary);
    margin: 0;
    flex: 1;
`

const HeaderInfo = styled.div`
    flex: 1;
    min-width: 0;
`

const HeaderMeta = styled.span`
    display: block;
    margin-top: var(--space-1);
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    letter-spacing: 0.04em;
`

const HeaderMascot = styled(SkyMascot)`
    width: 38px;
    height: 46px;
    flex: none;
    object-fit: cover;
    object-position: 50% 7%;
    border-radius: var(--radius-lg);
    background: var(--primary-light);
`

// ============================================
// Quick Translate
// ============================================

const TranslatePane = styled.div`
    --options-input-background: var(--control-surface-bg);

    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: var(--space-4);
    gap: var(--space-3);
    overflow-y: auto;
`

const LanguageRow = styled.div`
    --language-control-size: 32px;
    --select-trigger-height: var(--language-control-size);

    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
`

const LangBox = styled.div`
    flex: 1;
    min-width: 0;
`

const SwapButton = styled.button`
    width: var(--language-control-size);
    height: var(--language-control-size);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--control-surface-bg);
    color: var(--text-tertiary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all var(--transition-fast);

    svg {
        width: 14px;
        height: 14px;
    }

    &:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
        background: var(--control-surface-active-bg);
    }
`

const TextAreaWrapper = styled.div`
    flex: none;
    position: relative;
    display: flex;
    flex-direction: column;
`

const StyledTextarea = styled.textarea`
    width: 100%;
    min-height: 120px;
    padding: var(--space-3);
    padding-right: var(--space-8);
    background: var(--control-surface-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    font-size: var(--font-size-sm);
    font-family: var(--font-family);
    line-height: var(--line-height-relaxed);
    color: var(--text-primary);
    resize: none;
    box-sizing: border-box;
    transition: border-color var(--transition-fast);

    &::placeholder {
        color: var(--text-secondary);
    }

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }
`

const ClearButton = styled.button`
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    width: 20px;
    height: 20px;
    border: none;
    background: var(--gray-200);
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);

    svg {
        width: 10px;
        height: 10px;
    }

    &:hover {
        background: var(--gray-300);
        color: var(--text-primary);
    }
`

const ActionRow = styled.div`
    flex: none;
    display: flex;
    gap: var(--space-2);
`

const PasteButton = styled.button`
    flex: 1;
    padding: var(--space-2) var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    transition: all var(--transition-fast);

    svg {
        width: 14px;
        height: 14px;
    }

    &:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
        background: var(--primary-light);
    }
`

const TranslateButton = styled.button<{ $loading?: boolean }>`
    flex: 2;
    padding: var(--space-2) var(--space-4);
    background: var(--primary-color);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-inverse);
    cursor: ${p => (p.$loading ? "not-allowed" : "pointer")};
    opacity: ${p => (p.$loading ? 0.7 : 1)};
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    transition: all var(--transition-fast);

    svg {
        width: 14px;
        height: 14px;
    }

    &:hover:not(:disabled) {
        background: var(--primary-hover);
        box-shadow: var(--shadow-primary-sm);
    }

    &:active:not(:disabled) {
        transform: scale(0.98);
    }
`

const Divider = styled.div`
    flex: none;
    height: 1px;
    background: var(--border-light);
`

const ResultBox = styled.div`
    flex: 1 0 100px;
    box-sizing: border-box;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--control-surface-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
    position: relative;
`

const ResultText = styled.div<{ $empty?: boolean; $error?: boolean }>`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
    color: ${p =>
        p.$error
            ? "var(--error)"
            : p.$empty
              ? "var(--text-secondary)"
              : "var(--text-primary)"};
    white-space: pre-wrap;
    word-break: break-word;
`

const ResultActions = styled.div`
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-top: var(--space-2);
    gap: var(--space-2);
`

const IconButton = styled.button<{ $success?: boolean }>`
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: var(--font-size-xs);
    color: ${p => (p.$success ? "var(--success)" : "var(--text-tertiary)")};
    border-color: ${p =>
        p.$success ? "var(--success-border)" : "var(--border-color)"};
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all var(--transition-fast);

    svg {
        width: 12px;
        height: 12px;
    }

    &:hover {
        color: var(--primary-color);
        border-color: var(--primary-color);
        background: var(--primary-light);
    }
`

const LoadingBox = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-4);
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
`

const sourceOptions = [AUTO_DETECT_OPTION, ...languages.languages]
const targetOptions = languages.languages

export const SidePanel: React.FC = () => {
    const config = useConfig()

    const [inputText, setInputText] = useState("")
    const [result, setResult] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [copied, setCopied] = useState(false)
    const [sourceLang, setSourceLang] = useState("auto")
    const [targetLang, setTargetLang] = useState(config.targetLanguage)
    const [selectedRole, setSelectedRole] = useState(AiRole.DEFAULT)
    const [notice, setNotice] = useState("")

    const requestRef = useRef(0)
    const copyTimer = useRef<ReturnType<typeof setTimeout>>()
    const pasteTimer = useRef<ReturnType<typeof setTimeout>>()

    const supportsRoles =
        config.currentModel === MEWCAT_TRANSLATE_MODEL_ID ||
        Boolean(getSelectedGenerativeModel(config))
    const aiRole = supportsRoles ? selectedRole : AiRole.DEFAULT

    const invalidate = useCallback((keepResult = false) => {
        requestRef.current++
        clearTimeout(pasteTimer.current)
        pasteTimer.current = undefined
        setLoading(false)
        if (!keepResult) {
            setResult("")
        }
        setError("")
        setNotice("")
        setCopied(false)
    }, [])

    const translateInput = useCallback(
        async (value: string) => {
            const text = value.trim()
            invalidate()
            if (!text) {
                return
            }

            const request = requestRef.current

            setLoading(true)

            try {
                const newConfig = {
                    ...config,
                    sourceLanguage: sourceLang,
                    aiRole,
                    enableAutoAiRole: false
                }

                const translated = await translateText(
                    newConfig,
                    [{ role: "user", content: text }],
                    targetLang
                )
                if (request === requestRef.current) {
                    setResult(translated || "")
                }
            } catch (e) {
                if (
                    request === requestRef.current &&
                    (e as Error)?.name !== "AbortError"
                ) {
                    setError((e as Error)?.message || "翻译失败，请重试")
                }
            } finally {
                if (request === requestRef.current) {
                    setLoading(false)
                }
            }
        },
        [config, sourceLang, targetLang, aiRole, invalidate]
    )

    const handleTranslate = useCallback(() => {
        if (!loading) {
            void translateInput(inputText)
        }
    }, [inputText, loading, translateInput])

    const handleTextPaste = useCallback(
        (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
            if (
                event.defaultPrevented ||
                !event.clipboardData.getData("text/plain")
            ) {
                return
            }
            invalidate()
            const request = requestRef.current
            const textarea = event.currentTarget
            const nativeEvent = event.nativeEvent
            // 在原生粘贴结束后读取全文，以保留选区替换和撤销功能。
            pasteTimer.current = setTimeout(() => {
                pasteTimer.current = undefined
                if (
                    nativeEvent.defaultPrevented ||
                    request !== requestRef.current
                ) {
                    return
                }
                const text = textarea.value
                setInputText(text)
                void translateInput(text)
            }, 0)
        },
        [invalidate, translateInput]
    )

    const handlePaste = useCallback(async () => {
        invalidate()
        const request = requestRef.current
        try {
            const text = await navigator.clipboard.readText()
            if (request !== requestRef.current) {
                return
            }
            setInputText(text)
            void translateInput(text)
        } catch {
            if (request === requestRef.current) {
                setNotice(
                    "无法读取剪贴板，请使用 Ctrl+V（Mac 使用 ⌘V）手动粘贴。"
                )
            }
        }
    }, [invalidate, translateInput])

    const handleSwapLang = useCallback(() => {
        if (sourceLang === "auto") {
            return
        }
        invalidate()
        setSourceLang(targetLang)
        setTargetLang(sourceLang)
        setInputText(result)
        setResult("")
    }, [sourceLang, targetLang, result, invalidate])

    const handleCopy = useCallback(async () => {
        if (!result) {
            return
        }
        const request = requestRef.current
        try {
            await navigator.clipboard.writeText(result)
            if (request !== requestRef.current) {
                return
            }
            setCopied(true)
            clearTimeout(copyTimer.current)
            copyTimer.current = setTimeout(() => setCopied(false), 1500)
        } catch {
            if (request === requestRef.current) {
                setNotice("复制失败，请选中译文手动复制。")
            }
        }
    }, [result])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (
                e.key !== "Enter" ||
                e.defaultPrevented ||
                e.shiftKey ||
                e.altKey ||
                e.nativeEvent.isComposing ||
                e.nativeEvent.keyCode === 229
            ) {
                return
            }

            e.preventDefault()
            if (!e.repeat) {
                handleTranslate()
            }
        },
        [handleTranslate]
    )

    useEffect(
        () => () => {
            requestRef.current++
            clearTimeout(copyTimer.current)
            clearTimeout(pasteTimer.current)
        },
        []
    )

    return (
        <Container>
            <Header>
                <HeaderLogo size={28} />
                <HeaderInfo>
                    <HeaderTitle>翻译侧边栏</HeaderTitle>
                    <HeaderMeta>把每句话送到懂你的地方</HeaderMeta>
                </HeaderInfo>
                <HeaderMascot />
            </Header>

            <TranslatePane>
                <LanguageRow>
                    <LangBox>
                        <Select
                            aria-label="源语言"
                            value={sourceLang}
                            onChange={value => {
                                if (typeof value !== "string") {
                                    return
                                }
                                invalidate()
                                setSourceLang(value)
                            }}
                            options={sourceOptions}
                            placeholder="源语言"
                            withinPortal
                        />
                    </LangBox>
                    <SwapButton
                        onClick={handleSwapLang}
                        title="交换语言"
                        disabled={sourceLang === "auto"}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                    </SwapButton>
                    <LangBox>
                        <Select
                            aria-label="目标语言"
                            value={targetLang}
                            onChange={value => {
                                if (typeof value !== "string") {
                                    return
                                }
                                invalidate()
                                setTargetLang(value)
                            }}
                            options={targetOptions}
                            placeholder="目标语言"
                            withinPortal
                        />
                    </LangBox>
                </LanguageRow>

                <TranslationRolePicker
                    value={aiRole}
                    disabled={!supportsRoles}
                    onChange={role => {
                        if (role === aiRole) {
                            return
                        }
                        invalidate(true)
                        setSelectedRole(role)
                    }}
                />

                <TextAreaWrapper>
                    <StyledTextarea
                        value={inputText}
                        onChange={e => {
                            const isPendingPaste =
                                pasteTimer.current !== undefined &&
                                (e.nativeEvent as InputEvent).inputType ===
                                    "insertFromPaste"
                            if (!isPendingPaste) {
                                invalidate()
                            }
                            setInputText(e.target.value)
                        }}
                        onPaste={handleTextPaste}
                        onKeyDown={handleKeyDown}
                        aria-label="原文"
                        placeholder="粘贴文本后自动翻译…&#10;Enter 翻译，Shift+Enter 换行"
                        rows={5}
                    />
                    {inputText && (
                        <ClearButton
                            onClick={() => {
                                invalidate()
                                setInputText("")
                                setResult("")
                                setError("")
                            }}
                            title="清空"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            >
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </ClearButton>
                    )}
                </TextAreaWrapper>

                <ActionRow>
                    <PasteButton onClick={handlePaste}>
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                            <rect x="9" y="3" width="6" height="4" rx="1" />
                        </svg>
                        粘贴
                    </PasteButton>
                    <TranslateButton
                        onClick={handleTranslate}
                        $loading={loading}
                        disabled={loading || !inputText.trim()}
                    >
                        {loading ? (
                            <LoadingDots
                                loading
                                color="var(--text-inverse)"
                                size={4}
                            />
                        ) : (
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M5 3l14 9-14 9V3z" />
                            </svg>
                        )}
                        {loading ? "翻译中…" : "翻译"}
                    </TranslateButton>
                </ActionRow>

                <Divider />
                {notice && <p role="status">{notice}</p>}

                <ResultBox>
                    {loading ? (
                        <LoadingBox>
                            <LoadingDots
                                loading
                                color="var(--primary-color)"
                                size={4}
                            />
                            翻译中…
                        </LoadingBox>
                    ) : (
                        <ResultText $empty={!result && !error} $error={!!error}>
                            {error || result || "翻译结果将显示在这里"}
                        </ResultText>
                    )}
                    {result && !loading && (
                        <ResultActions>
                            <IconButton $success={copied} onClick={handleCopy}>
                                {copied ? (
                                    <>
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                        >
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                        已复制
                                    </>
                                ) : (
                                    <>
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <rect
                                                x="9"
                                                y="9"
                                                width="13"
                                                height="13"
                                                rx="2"
                                            />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                        复制
                                    </>
                                )}
                            </IconButton>
                            {!error && <TranslationMark placement="plain" />}
                        </ResultActions>
                    )}
                </ResultBox>
            </TranslatePane>
        </Container>
    )
}

export default SidePanel
