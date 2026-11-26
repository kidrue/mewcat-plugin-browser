import { styled } from "styled-components"

export const TokenPlanNote = styled.div`
    padding: var(--space-3);
    border: 1px solid var(--border-light);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);

    a {
        color: var(--primary-color);
    }
`

export const ConfigurationError = styled.div`
    color: var(--error);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);
`
