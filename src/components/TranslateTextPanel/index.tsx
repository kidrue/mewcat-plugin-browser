import React, { useLayoutEffect, useRef } from "react"
import Markdown, { type Components } from "react-markdown"
import { useAsyncRetry } from "react-use"
import styled from "styled-components"

import { UI_FONT_FAMILY } from "@/constants/fonts"
import { useConceptExplanation } from "@/hooks/useConceptExplanation"
import { useConfig } from "@/state/config"
import {
    notifySelectionTranslationFinished,
    translateSelectedText
} from "@/translation/selectionTranslation"
import {
    getConceptExplanationErrorMessage,
    translateText as translateWithService
} from "@/translation/translationService"

import LoadingDots from "../LoadingDots"
import TranslationMark from "../TranslationMark"

interface TranslateTextPanelProps {
    data?: string
    pageTitle?: string
    context?: string
    active?: boolean
    onFinished?: () => void
}

const SCxContainer = styled.div`
    font-family: ${UI_FONT_FAMILY};
    padding: 8px;
    color: #203b57;
    position: relative;
    width: 100%;
    max-height: 360px;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    overflow: hidden auto;
    box-sizing: border-box;
`

const SCxTranslationContent = styled.div`
    min-width: 0;
    min-height: 84px;
    display: flex;
    align-items: center;
    justify-content: center;
`

const SCxText = styled.div.withConfig({
    shouldForwardProp: prop => !(prop === "loading")
})<{ loading: boolean }>`
    min-width: 0;
    width: 100%;
    position: relative;
    box-sizing: border-box;
    padding: 4px 0 8px;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    opacity: ${props => (props.loading ? 0.5 : 1)};
    transition: opacity 0.2s ease;
`

const SCxErrorText = styled.div`
    font-size: 14px;
    font-weight: 500;
    line-height: 1.6;
    color: #b84c5a;
`

const SCxLoadingContainer = styled.div`
    width: 100%;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
`

const SCxLoadingText = styled.span`
    font-size: 12px;
    color: #6f879c;
    font-weight: 500;
`

const SCxActions = styled.div`
    padding-top: 8px;
    border-top: 1px solid #e3eef7;
    display: flex;
    align-items: center;
    gap: 8px;
`

const SCxExplainButton = styled.button`
    height: 28px;
    padding: 0 12px;
    border: 1px solid #2878c8;
    border-radius: var(--radius-md);
    background: rgba(40, 120, 200, 0.08);
    color: #2878c8;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;

    &:hover:not(:disabled) {
        background: rgba(40, 120, 200, 0.14);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }
`

const SCxActionHint = styled.span`
    color: #7c7469;
    font-size: 11px;
`

const SCxExplanation = styled.div`
    min-width: 0;
    margin-top: 8px;
    padding: 10px 12px;
    border: 1px solid #e3eef7;
    border-radius: var(--radius-lg);
    background: rgba(40, 120, 200, 0.04);
`

const SCxExplanationText = styled.div`
    min-width: 0;
    color: #203b57;
    font-size: 13px;
    line-height: 1.7;
    overflow-wrap: anywhere;

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
        margin: 12px 0 6px;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.5;
    }

    h1 {
        font-size: 16px;
    }

    h2 {
        font-size: 15px;
    }

    p,
    ul,
    ol,
    blockquote,
    pre {
        margin: 8px 0;
    }

    p,
    li {
        white-space: pre-line;
    }

    ul,
    ol {
        padding-left: 20px;
    }

    li + li {
        margin-top: 4px;
    }

    blockquote {
        padding-left: 10px;
        border-left: 3px solid #c1d7e8;
        color: #6f879c;
    }

    code {
        padding: 1px 4px;
        border-radius: 3px;
        background: rgba(40, 120, 200, 0.07);
        font-family: ui-monospace, monospace;
        font-size: 12px;
        white-space: pre-wrap;
    }

    pre {
        max-width: 100%;
        padding: 8px;
        overflow-x: auto;
        border-radius: 4px;
        background: rgba(32, 59, 87, 0.05);
        box-sizing: border-box;
        white-space: pre;
        overflow-wrap: normal;
    }

    pre code {
        padding: 0;
        background: none;
        white-space: inherit;
        overflow-wrap: normal;
    }

    a {
        color: #2878c8;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    > :first-child {
        margin-top: 0;
    }

    > :last-child {
        margin-bottom: 0;
    }
`

const explanationMarkdownComponents: Components = {
    a: ({ href, title, children }) =>
        href ? (
            <a
                href={href}
                title={title}
                target="_blank"
                rel="noopener noreferrer"
            >
                {children}
            </a>
        ) : (
            <>{children}</>
        ),
    img: ({ alt }) => <>{alt}</>
}

const SCxAiNotice = styled.div`
    margin-top: 8px;
    color: #6f879c;
    font-size: 10px;
`

export const TranslateTextPanel: React.FunctionComponent<
    TranslateTextPanelProps
> = ({ data, pageTitle, context, active = true, onFinished }) => {
    const config = useConfig()

    const {
        value: translateText,
        loading,
        error
    } = useAsyncRetry(async () => {
        if (!data) {
            return
        }
        const result = await translateSelectedText(
            {
                translateText: (messages, targetLanguage) =>
                    translateWithService(config, messages, targetLanguage)
            },
            data,
            config
        )

        return result
    }, [data, config])

    const [explanationState, requestExplanation] = useConceptExplanation(
        config,
        { text: data ?? "", pageTitle, context },
        config.targetLanguage,
        active
    )
    const layoutTimer = useRef<ReturnType<typeof setTimeout>>()

    useLayoutEffect(() => {
        if (translateText && !loading) {
            notifySelectionTranslationFinished(onFinished)
        }
    }, [loading, onFinished, translateText])

    useLayoutEffect(() => {
        if (
            explanationState.loading ||
            explanationState.error ||
            explanationState.value
        ) {
            if (explanationState.loading && explanationState.value) {
                if (layoutTimer.current === undefined) {
                    layoutTimer.current = setTimeout(() => {
                        layoutTimer.current = undefined
                        notifySelectionTranslationFinished(onFinished)
                    }, 32)
                }
            } else {
                clearTimeout(layoutTimer.current)
                layoutTimer.current = undefined
                notifySelectionTranslationFinished(onFinished)
            }
        }
    }, [
        explanationState.error,
        explanationState.loading,
        explanationState.value,
        onFinished
    ])

    useLayoutEffect(
        () => () => {
            clearTimeout(layoutTimer.current)
            layoutTimer.current = undefined
        },
        [onFinished]
    )

    return (
        <SCxContainer>
            <SCxTranslationContent>
                <SCxText loading={loading}>
                    {translateText || ""}
                    {translateText && !loading && !error && (
                        <TranslationMark placement="corner" />
                    )}
                </SCxText>

                {loading && (
                    <SCxLoadingContainer>
                        <LoadingDots loading={true} color="#2878c8" size={4} />
                        <SCxLoadingText>翻译中...</SCxLoadingText>
                    </SCxLoadingContainer>
                )}
                {error && <SCxErrorText>{error.message} </SCxErrorText>}
            </SCxTranslationContent>

            <SCxActions>
                <SCxExplainButton
                    type="button"
                    disabled={!data || !active || explanationState.loading}
                    onClick={() => void requestExplanation()}
                >
                    {explanationState.loading
                        ? "解释中..."
                        : explanationState.value
                          ? "重新解释"
                          : "解释概念"}
                </SCxExplainButton>
                <SCxActionHint>使用已配置的 AI 模型</SCxActionHint>
            </SCxActions>

            {explanationState.error && (
                <SCxErrorText>
                    {getConceptExplanationErrorMessage(explanationState.error)}
                </SCxErrorText>
            )}
            {explanationState.value && (
                <SCxExplanation>
                    <SCxExplanationText>
                        <Markdown
                            skipHtml
                            components={explanationMarkdownComponents}
                        >
                            {explanationState.value}
                        </Markdown>
                    </SCxExplanationText>
                    <SCxAiNotice>AI 生成，未联网核验</SCxAiNotice>
                </SCxExplanation>
            )}
        </SCxContainer>
    )
}
