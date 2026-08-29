import React, { useLayoutEffect } from "react"
import { useAsyncFn, useAsyncRetry } from "react-use"
import styled from "styled-components"

import { useConfig } from "@/state/config"
import {
    notifySelectionTranslationFinished,
    translateSelectedText
} from "@/translation/selectionTranslation"
import {
    explainConcept as explainWithService,
    getConceptExplanationErrorMessage,
    translateText as translateWithService
} from "@/translation/translationService"

import LoadingDots from "../LoadingDots"

interface TranslateTextPanelProps {
    data?: string
    pageTitle?: string
    context?: string
    onFinished?: () => void
}

const SCxContainer = styled.div`
    padding: 8px;
    color: #1a1714;
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
    min-height: 84px;
    display: flex;
    align-items: center;
    justify-content: center;
`

const SCxText = styled.div.withConfig({
    shouldForwardProp: prop => !(prop === "loading")
})<{ loading: boolean }>`
    font-size: 15px;
    font-weight: 500;
    line-height: 1.7;
    opacity: ${props => (props.loading ? 0.5 : 1)};
    transition: opacity 0.2s ease;
`

const SCxErrorText = styled.div`
    font-size: 14px;
    font-weight: 500;
    line-height: 1.6;
    color: #a5342a;
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
    color: #6e665c;
    font-weight: 500;
`

const SCxActions = styled.div`
    padding-top: 8px;
    border-top: 1px solid #e4ddcd;
    display: flex;
    align-items: center;
    gap: 8px;
`

const SCxExplainButton = styled.button`
    height: 28px;
    padding: 0 12px;
    border: 1px solid #b23a2e;
    border-radius: var(--radius-md);
    background: rgba(178, 58, 46, 0.08);
    color: #b23a2e;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;

    &:hover:not(:disabled) {
        background: rgba(178, 58, 46, 0.14);
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
    margin-top: 8px;
    padding: 10px 12px;
    border: 1px solid #e4ddcd;
    border-radius: var(--radius-lg);
    background: rgba(178, 58, 46, 0.04);
`

const SCxExplanationText = styled.div`
    color: #1a1714;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
`

const SCxAiNotice = styled.div`
    margin-top: 8px;
    color: #7c7469;
    font-size: 10px;
`

export const TranslateTextPanel: React.FunctionComponent<
    TranslateTextPanelProps
> = ({ data, pageTitle, context, onFinished }) => {
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

    const [explanationState, requestExplanation] = useAsyncFn(async () => {
        if (!data) {
            return
        }
        return explainWithService(
            config,
            { text: data, pageTitle, context },
            config.targetLanguage
        )
    }, [config, context, data, pageTitle])

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
            notifySelectionTranslationFinished(onFinished)
        }
    }, [
        explanationState.error,
        explanationState.loading,
        explanationState.value,
        onFinished
    ])

    return (
        <SCxContainer>
            <SCxTranslationContent>
                <SCxText loading={loading}>{translateText || ""}</SCxText>

                {loading && (
                    <SCxLoadingContainer>
                        <LoadingDots loading={true} color="#b23a2e" size={4} />
                        <SCxLoadingText>翻译中...</SCxLoadingText>
                    </SCxLoadingContainer>
                )}
                {error && <SCxErrorText>{error.message} </SCxErrorText>}
            </SCxTranslationContent>

            <SCxActions>
                <SCxExplainButton
                    type="button"
                    disabled={!data || explanationState.loading}
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
                        {explanationState.value}
                    </SCxExplanationText>
                    <SCxAiNotice>AI 生成，未联网核验</SCxAiNotice>
                </SCxExplanation>
            )}
        </SCxContainer>
    )
}
