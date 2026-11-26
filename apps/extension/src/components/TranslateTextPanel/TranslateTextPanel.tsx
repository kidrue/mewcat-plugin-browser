import React, { useEffect, useLayoutEffect, useRef } from "react"
import type { Components } from "react-markdown"
import Markdown from "react-markdown"

import { notifySelectionTranslationFinished } from "@/features/translation/selectionTranslation"
import { useSelectionTranslation } from "@/hooks/useSelectionTranslation"
import { useConfig } from "@/state/config"

import LoadingDots from "../LoadingDots"
import TranslationMark from "../TranslationMark"
import {
    SCxAiNotice,
    SCxContainer,
    SCxErrorText,
    SCxExplanationText,
    SCxLoadingContainer,
    SCxLoadingText,
    SCxRetryButton,
    SCxText,
    SCxTranslationContent
} from "./styles"
import type { TranslateTextPanelProps } from "./types"

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

export const TranslateTextPanel: React.FC<TranslateTextPanelProps> = ({
    data,
    pageTitle,
    context,
    active = true,
    onFinished,
    onResultChange
}) => {
    const config = useConfig()

    const { result, retry } = useSelectionTranslation(
        config,
        { text: data ?? "", pageTitle, context },
        config.targetLanguage,
        active
    )
    const { mode, value, explanation, loading, error, notice } = result
    const layoutTimer = useRef<ReturnType<typeof setTimeout>>()

    useEffect(() => {
        onResultChange?.(result)
    }, [result, onResultChange])

    useLayoutEffect(() => {
        if (loading && value) {
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
    }, [loading, value, explanation, error, notice, onFinished])
    useLayoutEffect(
        () => () => {
            clearTimeout(layoutTimer.current)
            layoutTimer.current = undefined
        },
        [onFinished, active, data, context]
    )

    return (
        <SCxContainer aria-busy={loading}>
            {mode === "explain" && value ? (
                <>
                    <SCxText loading={false}>译文：{value}</SCxText>
                    {explanation && (
                        <SCxExplanationText>
                            <div>术语解释：</div>
                            <Markdown
                                skipHtml
                                components={explanationMarkdownComponents}
                            >
                                {explanation}
                            </Markdown>
                        </SCxExplanationText>
                    )}
                    <SCxAiNotice>
                        {loading ? "解释中..." : "AI 生成，未联网核验"}
                    </SCxAiNotice>
                </>
            ) : (
                <SCxTranslationContent>
                    {value && (
                        <SCxText loading={loading}>
                            译文：{value}
                            {!loading && !error && (
                                <TranslationMark placement="corner" />
                            )}
                        </SCxText>
                    )}
                    {loading && (
                        <SCxLoadingContainer role="status">
                            <LoadingDots
                                loading={true}
                                color="#2878c8"
                                size={4}
                            />
                            <SCxLoadingText>
                                {mode === "analyzing"
                                    ? "识别术语中..."
                                    : "翻译中..."}
                            </SCxLoadingText>
                        </SCxLoadingContainer>
                    )}
                    {error && (
                        <SCxErrorText role="alert">
                            {error}{" "}
                            <SCxRetryButton
                                type="button"
                                onClick={retry}
                                disabled={loading || !active}
                            >
                                重试翻译
                            </SCxRetryButton>
                        </SCxErrorText>
                    )}
                </SCxTranslationContent>
            )}
            {notice && <SCxAiNotice role="status">{notice}</SCxAiNotice>}
        </SCxContainer>
    )
}
