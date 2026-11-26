import styled from "styled-components"

import type { TranslationStyleType } from "@/types/translationStyle"
import { getTranslationStyleCSS } from "@/utils/style"

export const SCxPreviewContainer = styled.div`
    position: relative;
    overflow: hidden;
    padding: var(--space-3) var(--space-4);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
`

export const SCxPreviewText = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "styleName"
})<{ styleName: TranslationStyleType }>`
    ${props => getTranslationStyleCSS(props.styleName)}
`

export const SCxOriginalText = styled.p`
    margin: 0 0 var(--space-2);
    color: var(--text-secondary);
`
