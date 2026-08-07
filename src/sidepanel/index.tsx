import { clone } from "ramda"
import * as React from "react"
import { useCallback, useRef, useState } from "react"
import styled from "styled-components"

import "@/styles/theme.scss"

import { AUTO_DETECT_OPTION, languages } from "@/constants"
import { useConfig } from "@/state/config"
import { TranslationServiceManager } from "@/translation/TranslationServiceManager"

import LoadingDots from "../components/LoadingDots"
import NativeSelect from "../components/NativeSelect"

// ============================================
// Layout
// ============================================

const Container = styled.div`
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    font-family: var(--font-family);
    color: var(--text-primary);
`

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-secondary);
    flex-shrink: 0;
    /* 骑缝线 */
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
    }
`

// 朱砂印 —— 与悬浮球、popup 同形制
const Seal = styled.div`
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: 4px;
    background: var(--primary-color);
    color: var(--text-inverse);
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: var(--font-weight-semibold);
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 0 0 1px rgba(251, 248, 240, 0.55);
    user-select: none;
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

// ============================================
// Quick Translate
// ============================================

const TranslatePane = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--space-4);
    gap: var(--space-3);
    overflow-y: auto;
`

const LanguageRow = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-2);
`

const LangBox = styled.div`
    flex: 1;
    min-width: 0;
`

const SwapButton = styled.button`
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
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
        background: var(--primary-light);
    }
`

const TextAreaWrapper = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
`

const StyledTextarea = styled.textarea`
    width: 100%;
    min-height: 120px;
    padding: var(--space-3);
    padding-right: var(--space-8);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family);
    line-height: var(--line-height-relaxed);
    color: var(--text-primary);
    resize: vertical;
    box-sizing: border-box;
    transition: border-color var(--transition-fast);

    &::placeholder {
        color: var(--text-tertiary);
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
    height: 1px;
    background: var(--border-light);
`

const ResultBox = styled.div`
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    min-height: 100px;
    padding: var(--space-3);
    position: relative;
`

const ResultText = styled.div<{ $empty?: boolean; $error?: boolean }>`
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
    color: ${p =>
        p.$error
            ? "var(--error)"
            : p.$empty
              ? "var(--text-tertiary)"
              : "var(--text-primary)"};
    white-space: pre-wrap;
    word-break: break-word;
    min-height: 60px;
`

const ResultActions = styled.div`
    display: flex;
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

// ============================================
// Component
// ============================================

const SlidePanel: React.FunctionComponent = () => {
    const [inputText, setInputText] = useState("")
    const [result, setResult] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [copied, setCopied] = useState(false)
    const [sourceLang, setSourceLang] = useState("auto")
    const [targetLang, setTargetLang] = useState("zh-CN")
    const abortRef = useRef<AbortController | null>(null)

    const config = useConfig()

    const sourceOptions = [AUTO_DETECT_OPTION, ...languages.languages]
    const targetOptions = languages.languages

    const handlePaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText()
            setInputText(text)
        } catch {
            // clipboard permission denied, user can type manually
        }
    }, [])

    const handleTranslate = useCallback(async () => {
        const text = inputText.trim()
        if (!text || loading) return

        abortRef.current?.abort()
        abortRef.current = new AbortController()

        setLoading(true)
        setError("")
        setResult("")

        try {
            const newConfig = clone(config)
            if (sourceLang !== "auto") {
                newConfig.detectedLanguage = sourceLang
            }

            const manager = new TranslationServiceManager(newConfig)
            const translated = await manager.translateText(
                [{ role: "user", content: text }],
                targetLang
            )
            setResult(translated || "")
        } catch (e) {
            if ((e as Error)?.name !== "AbortError") {
                setError((e as Error)?.message || "翻译失败，请重试")
            }
        } finally {
            setLoading(false)
        }
    }, [inputText, loading, config, sourceLang, targetLang])

    const handleSwapLang = useCallback(() => {
        if (sourceLang === "auto") return
        setSourceLang(targetLang)
        setTargetLang(sourceLang)
        setInputText(result)
        setResult("")
    }, [sourceLang, targetLang, result])

    const handleCopy = useCallback(async () => {
        if (!result) return
        await navigator.clipboard.writeText(result)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }, [result])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                handleTranslate()
            }
        },
        [handleTranslate]
    )

    return (
        <Container>
            <Header>
                <Seal aria-hidden="true">譯</Seal>
                <HeaderTitle>翻译侧边栏</HeaderTitle>
            </Header>

            <TranslatePane>
                <LanguageRow>
                    <LangBox>
                        <NativeSelect
                            value={sourceLang}
                            onChange={setSourceLang}
                            options={sourceOptions}
                            placeholder="源语言"
                            size="sm"
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
                        <NativeSelect
                            value={targetLang}
                            onChange={setTargetLang}
                            options={targetOptions}
                            placeholder="目标语言"
                            size="sm"
                        />
                    </LangBox>
                </LanguageRow>

                <TextAreaWrapper>
                    <StyledTextarea
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="输入或粘贴要翻译的文本…&#10;Ctrl+Enter 快速翻译"
                        rows={5}
                    />
                    {inputText && (
                        <ClearButton
                            onClick={() => {
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
                        </ResultActions>
                    )}
                </ResultBox>
            </TranslatePane>
        </Container>
    )
}

export default SlidePanel
