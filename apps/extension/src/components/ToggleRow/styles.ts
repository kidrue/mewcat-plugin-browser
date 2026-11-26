import styled from "styled-components"

export const SCxToggleRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-light);
    transition: var(--transition-base);

    &:last-child {
        border-bottom: none;
    }

    &:hover {
        background: var(--gray-50);
        border-radius: var(--radius-md);
    }
`

export const SCxToggleLabel = styled.div`
    flex: 1;
    padding-right: var(--space-4);
`

export const SCxToggleTitle = styled.div`
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    margin-bottom: var(--space-1);
`

export const SCxToggleDescription = styled.div`
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: var(--line-height-normal);
`
