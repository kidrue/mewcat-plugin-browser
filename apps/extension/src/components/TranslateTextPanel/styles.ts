import styled from "styled-components"

import { UI_FONT_FAMILY } from "@/constants/fonts"

export const SCxContainer = styled.div`
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

export const SCxTranslationContent = styled.div`
    min-width: 0;
    min-height: 84px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`

export const SCxText = styled.div.withConfig({
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

export const SCxErrorText = styled.div`
    font-size: 14px;
    font-weight: 500;
    line-height: 1.6;
    color: #b84c5a;
`

export const SCxLoadingContainer = styled.div`
    width: 100%;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
`

export const SCxLoadingText = styled.span`
    font-size: 12px;
    color: #6f879c;
    font-weight: 500;
`

export const SCxRetryButton = styled.button`
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

export const SCxExplanationText = styled.div`
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

export const SCxAiNotice = styled.div`
    margin-top: 8px;
    color: #6f879c;
    font-size: 10px;
`
