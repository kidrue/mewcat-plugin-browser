import { styled } from "styled-components"

export const SCXList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 0;
    width: 150px;
    background-color: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-2) 0;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    z-index: var(--z-dropdown);
`

export const SCXListItem = styled.li`
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    transition: all var(--transition-fast);

    &:hover {
        background-color: var(--gray-100);
    }
`
