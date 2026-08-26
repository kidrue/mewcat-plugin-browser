import { clone } from "ramda"
import React, { useLayoutEffect } from "react"
import { useAsyncRetry } from "react-use"
import styled from "styled-components"

import { useConfig } from "@/state/config"
import {
    notifySelectionTranslationFinished,
    translateSelectedText
} from "@/translation/selectionTranslation"
import { TranslationServiceManager } from "@/translation/TranslationServiceManager"

import LoadingDots from "../LoadingDots"

interface TranslateTextPanelProps {
    data?: string
    onFinished?: () => void
}

const SCxContainer = styled.div`
    padding: 8px;
    color: #1a1714;
    position: relative;
    width: 100%;
    max-height: 250px;
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden auto;
    box-sizing: border-box;
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
export const TranslateTextPanel: React.FunctionComponent<
    TranslateTextPanelProps
> = ({ data, onFinished }) => {
    const config = useConfig()

    const {
        value: translateText,
        loading,
        error
    } = useAsyncRetry(async () => {
        if (!data) {
            return
        }
        const newConfig = clone(config)

        const translationManager = new TranslationServiceManager(newConfig)
        const result = await translateSelectedText(
            translationManager,
            data,
            config
        )

        return result
    }, [data, config])

    useLayoutEffect(() => {
        if (translateText && !loading) {
            notifySelectionTranslationFinished(onFinished)
        }
    }, [loading, onFinished, translateText])

    return (
        <SCxContainer>
            <SCxText loading={loading}>{translateText || ""}</SCxText>

            {loading && (
                <SCxLoadingContainer>
                    <LoadingDots loading={true} color="#b23a2e" size={4} />
                    <SCxLoadingText>翻译中...</SCxLoadingText>
                </SCxLoadingContainer>
            )}
            {error && <SCxErrorText>{error.message} </SCxErrorText>}
        </SCxContainer>
    )
}
