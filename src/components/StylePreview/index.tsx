import React from "react"
import styled from "styled-components"

import type { TranslationStyleType } from "@/types/translationStyle"
import { getTranslationStyleCSS } from "@/utils"

interface StylePreviewProps {
    style: TranslationStyleType
    className?: string
}

const SCxPreviewContainer = styled.div`
    position: relative;
    overflow: hidden;
    padding: var(--space-3) var(--space-4);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
`

const SCxPreviewText = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "styleName"
})<{ styleName: TranslationStyleType }>`
    ${props => getTranslationStyleCSS(props.styleName)}
`

const StylePreview: React.FC<StylePreviewProps> = ({ style, className }) => {
    return (
        <SCxPreviewContainer className={className}>
            <SCxPreviewText styleName={style}>
                This is a translation example 这是一个翻译示例
            </SCxPreviewText>
        </SCxPreviewContainer>
    )
}

export default StylePreview
