import styled from "styled-components"

import { skyCardArtwork } from "@/components/SkyArtwork"

export const Button = styled.button<{ $danger?: boolean }>`
    min-height: 40px;
    padding: var(--space-2) var(--space-4);
    border: 1px solid
        ${props =>
            props.$danger ? "var(--error-border)" : "var(--border-color)"};
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: ${props => (props.$danger ? "var(--error)" : "var(--text-primary)")};
    font: inherit;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: ${props =>
            props.$danger ? "var(--error-bg)" : "var(--primary-light)"};
    }

    &:focus-visible {
        outline: 2px solid var(--border-focus);
        outline-offset: 3px;
    }

    &:disabled {
        opacity: 0.6;
        cursor: wait;
    }
`

export const Cards = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    @media (max-width: 760px) {
        grid-template-columns: 1fr;
    }
`

export const Card = styled.article`
    min-width: 0;
    padding: var(--space-5);
    background: var(--bg-secondary);
    ${skyCardArtwork("usageLedger")}
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xs);
`

export const CardLabel = styled.h3`
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
`

export const Total = styled.div`
    margin: var(--space-2) 0;
    font-family: var(--font-mono);
    font-size: clamp(24px, 2.8vw, 32px);
    color: var(--primary-color);
    overflow-wrap: anywhere;

    small {
        margin-left: var(--space-2);
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        font-family: var(--font-family);
    }
`

export const TableWrap = styled.div`
    min-width: 0;
    overflow-x: auto;

    &:focus-visible {
        outline: 2px solid var(--border-focus);
        outline-offset: 4px;
        border-radius: var(--radius-sm);
    }
`

export const Table = styled.table`
    width: 100%;
    min-width: 640px;
    border-collapse: collapse;
    thead {
        border: 1px solid var(--border-color);
    }
    th,
    td {
        padding: var(--space-3) var(--space-4);
        text-align: left;
        border-bottom: 1px solid var(--border-color);
    }
    th {
        color: var(--text-secondary);
        font-weight: var(--font-weight-medium);
        background: var(--bg-primary);
        white-space: nowrap;
    }
    td:first-child {
        max-width: 280px;
        overflow-wrap: anywhere;
    }
    td:nth-child(2),
    td:nth-child(3) {
        white-space: nowrap;
    }
    td:nth-last-child(-n + 4),
    th:nth-last-child(-n + 4) {
        text-align: right;
        font-family: var(--font-mono);
    }
    tr:last-child td {
        border-bottom: 0;
    }
`

export const Empty = styled.div`
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--text-secondary);
    background: var(--bg-primary);
    border-radius: var(--radius-lg);

    p {
        margin: var(--space-2) 0 0;
        font-size: var(--font-size-sm);
    }
`

export const Management = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-4);

    p {
        flex: 1 1 240px;
        margin: 0;
        color: var(--text-secondary);
        line-height: var(--line-height-relaxed);
        font-size: var(--font-size-sm);
    }
`

export const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
`

export const ErrorMessage = styled.p`
    margin: var(--space-3) 0 0;
    color: var(--error);
    font-size: var(--font-size-sm);
`

export const format = (value: number) => value.toLocaleString("zh-CN")

export const CharacterUsageContent = styled.div`
    display: grid;
    gap: var(--space-4);

    > * {
        min-width: 0;
    }
`

export const CharacterTable = styled(Table)`
    min-width: 440px;

    caption {
        padding-bottom: var(--space-2);
        color: var(--text-secondary);
        font-weight: var(--font-weight-medium);
        text-align: left;
    }

    th:first-child {
        text-align: left;
        font-family: var(--font-family);
    }

    tbody th {
        background: transparent;
        overflow-wrap: anywhere;
        white-space: normal;
    }

    td,
    thead th:not(:first-child) {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    tbody tr:last-child th {
        border-bottom: 0;
    }
`
