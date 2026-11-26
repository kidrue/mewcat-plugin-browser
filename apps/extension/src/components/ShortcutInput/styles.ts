import styled from "styled-components"

export const Controls = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    max-width: 100%;
    input {
        min-width: 80px;
        width: 140px;
        flex: 1;
    }
    input,
    button {
        height: 36px;
        padding: 0 var(--space-3);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        font: inherit;
        color: var(--text-primary);
        background: var(--bg-secondary);
    }
    input:focus-visible,
    button:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
    button {
        cursor: pointer;
        white-space: nowrap;
    }
    :disabled {
        opacity: 0.5;
        cursor: default;
    }
`

export const ErrorMessage = styled.p`
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--error);
`
