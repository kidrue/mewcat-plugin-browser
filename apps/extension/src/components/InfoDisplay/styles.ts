import styled from "styled-components"

export const SCxInfoRow = styled.div`
    margin-bottom: var(--space-5);

    &:last-child {
        margin-bottom: 0;
    }
`

export const SCxLabel = styled.label`
    display: block;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
`

export const SCxValue = styled.span<{ valueType: string }>`
    font-size: var(--font-size-base);
    color: var(--text-primary);
    font-weight: var(--font-weight-normal);

    ${props =>
        props.valueType === "version" &&
        `
        font-family: var(--font-mono);
        background: var(--bg-tertiary);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        color: var(--primary-color);
        border: 1px solid var(--border-color);
        display: inline-block;
    `}

    ${props =>
        props.valueType === "strong" &&
        `
        font-weight: var(--font-weight-semibold);
    `}
`
