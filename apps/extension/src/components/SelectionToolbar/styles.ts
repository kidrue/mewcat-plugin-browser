import styled from "styled-components"

export const Actions = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
`

export const ActionButton = styled.button`
    width: 30px;
    height: 30px;
    padding: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-md, 8px);
    background: transparent;
    color: #6f879c;
    cursor: pointer;
    transition:
        color 0.16s ease,
        background 0.16s ease;

    &:hover:not(:disabled),
    &[aria-pressed="true"] {
        color: #2878c8;
        background: #eaf4fd;
    }
    &:focus-visible {
        outline: 2px solid #2878c8;
        outline-offset: 2px;
    }
    &:disabled {
        opacity: 0.4;
        cursor: default;
    }
    svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
    }
`

export const Notice = styled.span`
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 1;
    width: max-content;
    max-width: 210px;
    padding: 6px 9px;
    border-radius: var(--radius-md, 8px);
    background: #eef7ff;
    color: #203b57;
    font-size: 11px;
    line-height: 1.6;
    box-shadow: 0 3px 12px rgba(32, 59, 87, 0.12);
    pointer-events: none;
`
