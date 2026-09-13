import React from "react"
import styled from "styled-components"

import type { TranslationStyleType } from "@/types/translationStyle"
import { getTranslationStyleCSS, shouldInsertAsBlock } from "@/utils/style"

import TranslationMark from "../TranslationMark"

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
    border-radius: var(--radius-lg);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
`

const SCxPreviewText = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "styleName"
})<{ styleName: TranslationStyleType }>`
    ${props => getTranslationStyleCSS(props.styleName)}
`

const SCxOriginalText = styled.p`
    margin: 0 0 var(--space-2);
    color: var(--text-secondary);
`

const StylePreview: React.FC<StylePreviewProps> = ({ style, className }) => {
    return (
        <SCxPreviewContainer className={className}>
            <SCxOriginalText>
                A gentle breeze turns the pages. Take your time and enjoy
                reading.
            </SCxOriginalText>
            <SCxPreviewText styleName={style}>
                微风轻轻翻动书页，慢慢读，让每一段文字都清晰舒展。
                <TranslationMark
                    placement={
                        shouldInsertAsBlock(style) ? "border-corner" : "inline"
                    }
                />
            </SCxPreviewText>
        </SCxPreviewContainer>
    )
}

export default StylePreview
