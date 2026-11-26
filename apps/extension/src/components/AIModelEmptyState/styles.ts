import { styled } from "styled-components"

export const EmptyStatePanel = styled.div`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--space-3);
    max-width: 36rem;
`

export const EmptyStateMark = styled.span`
    width: 10px;
    height: 10px;
    margin: 7px 2px 0;
    background: var(--primary-color);
    border-radius: 2px;
    transform: rotate(45deg);
`

export const EmptyStateTitle = styled.h3`
    margin: 0;
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: var(--font-size-2xl);
    line-height: var(--line-height-tight);
`

export const EmptyStateDescription = styled.p`
    margin: var(--space-2) 0 var(--space-4);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
`
