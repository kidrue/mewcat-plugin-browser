import styled, { css } from "styled-components"

export const RoleControls = styled.div`
    flex: none;
    display: grid;
    gap: var(--space-2);
    min-width: 0;
`

export const TagList = styled.div`
    --role-tag-height: 32px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
`

const rolePill = css`
    flex: none;
    box-sizing: border-box;
    height: var(--role-tag-height);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-full);
    background: var(--control-surface-bg);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--font-size-xs);

    &[aria-pressed="true"],
    &[aria-expanded="true"],
    &:has(> button[aria-pressed="true"]),
    &:hover:not(:disabled) {
        border-color: var(--primary-color);
        background: var(--control-surface-active-bg);
        color: var(--primary-hover);
    }
`

export const RoleAction = styled.button`
    padding: var(--space-1) var(--space-2);
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: -2px;
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`

export const RoleButton = styled(RoleAction)`
    ${rolePill}
`

export const AddRoleButton = styled(RoleButton)`
    display: grid;
    place-items: center;
    width: 44px;
    padding: 0;

    svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
    }
`

export const RoleTag = styled.div`
    ${rolePill}
    display: inline-flex;

    > :first-child {
        padding-inline-end: 0;
    }
`

export const RemoveRoleButton = styled(RoleAction)`
    display: grid;
    place-items: center start;
    min-width: var(--space-6);
    padding-inline: var(--space-1);

    svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
    }
`

export const RoleHint = styled.p`
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
`
