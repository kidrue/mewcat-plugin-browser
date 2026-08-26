import { css } from "styled-components"

export const hideScrollBar = () => css`
    &::-webkit-scrollbar {
        display: none;
    }
`

export const tinyButtons = () => css`
    scrollbar-width: 4px;

    &::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }

    &::-webkit-scrollbar-thumb {
        color: #ccc;
        border-radius: var(--radius-lg, 12px);
        background: #ccc;
        box-shadow: inset 0 0 1px rgba(0, 0, 0, 0.5);
    }

    &::-webkit-scrollbar-track {
        border-radius: var(--radius-lg, 12px);
        background: #fff0;
    }

    &::-webkit-scrollbar-button {
        color: #ccc;
    }
`
