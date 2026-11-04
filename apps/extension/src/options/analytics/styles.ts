import styled from "styled-components"

export const Page = styled.div`
    display: grid;
    gap: var(--space-6);
    min-width: 0;
    > * {
        min-width: 0;
        margin-bottom: 0;
    }
    h3,
    h4,
    p {
        margin-top: 0;
    }
    h3 {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
    }
    h4 {
        margin-bottom: var(--space-3);
    }
    button,
    input,
    select {
        font: inherit;
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 3px;
    }
`
export const Button = styled.button`
    min-height: 38px;
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--primary-color);
    cursor: pointer;
    font: inherit;
    &:hover:not(:disabled) {
        background: var(--bg-tertiary);
    }
    &:disabled {
        opacity: 0.55;
        cursor: default;
    }
    &[aria-pressed="true"] {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: var(--text-inverse);
    }
`
export const Toolbar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-4);
`
export const Row = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
`
export const Tabs = styled.div`
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border-color);
    button {
        padding: var(--space-3) var(--space-4);
        border: 0;
        border-bottom: 2px solid transparent;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
    }
    button[aria-pressed="true"] {
        border-bottom-color: var(--primary-color);
        color: var(--primary-color);
    }
`
export const Card = styled.section`
    min-width: 0;
    padding: var(--space-6);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    background: var(--bg-secondary);
    box-shadow: var(--shadow-sm);
    @media (max-width: 600px) {
        padding: var(--space-4);
    }
`
export const Muted = styled.p`
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
    margin: var(--space-3) 0 0;
    overflow-wrap: anywhere;
`
export const Mono = styled.span`
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
`
export const Metrics = styled.div`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-4);
    @media (max-width: 1000px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    @media (max-width: 400px) {
        grid-template-columns: 1fr;
    }
`
export const Metric = styled(Card)`
    padding: var(--space-5);
    color: var(--text-secondary);
    strong {
        display: block;
        margin: var(--space-3) 0 var(--space-2);
        font: 500 clamp(21px, 2.5vw, 28px) / 1.25 var(--font-mono);
        color: var(--primary-color);
        overflow-wrap: anywhere;
    }
    small {
        font-size: var(--font-size-xs);
    }
`
export const Field = styled.label`
    display: grid;
    gap: var(--space-2);
    min-width: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    input,
    select {
        width: 100%;
        min-height: 38px;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        background: var(--bg-secondary);
        color: var(--text-primary);
        min-width: 0;
    }
`
export const Filters = styled.form`
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
    label {
        flex: 1;
        min-width: 150px;
    }
`
export const TableScroll = styled.div`
    width: 100%;
    overflow-x: auto;
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm);
        white-space: nowrap;
    }
    th,
    td {
        text-align: left;
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--border-light);
    }
    th {
        font-weight: var(--font-weight-medium);
        color: var(--text-secondary);
        background: var(--bg-tertiary);
    }
    td {
        vertical-align: top;
    }
    td button {
        border: 0;
        padding: 0;
        background: transparent;
        color: var(--primary-color);
        cursor: pointer;
        font: inherit;
        text-align: left;
    }
    caption {
        text-align: left;
        margin-bottom: var(--space-3);
        color: var(--text-secondary);
    }
`
export const Distribution = styled.div`
    display: grid;
    gap: var(--space-4);
    .label {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        font-size: var(--font-size-sm);
    }
    .track {
        height: 7px;
        margin-top: var(--space-2);
        border-radius: 6px;
        background: var(--bg-tertiary);
        overflow: hidden;
    }
    .bar {
        height: 100%;
        border-radius: inherit;
        background: var(--primary-color);
    }
`
export const Alert = styled.div`
    padding: var(--space-4);
    border: 1px solid var(--border-color);
    border-left: 3px solid var(--primary-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    line-height: var(--line-height-relaxed);
`
export const LoadingCards = styled.div`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-4);
    div {
        height: 118px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-xl);
        background: var(--bg-tertiary);
        opacity: 0.65;
    }
    @media (max-width: 1000px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    @media (max-width: 400px) {
        grid-template-columns: 1fr;
    }
`
export const fmt = (value: string | number | null | undefined) =>
    value == null
        ? "—"
        : typeof value === "string" && /^\d+$/.test(value)
          ? new Intl.NumberFormat("zh-CN").format(BigInt(value))
          : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(
                Number(value)
            )
export const localTime = (value: string | null) =>
    value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—"
export const percent = (value: number | null) =>
    value == null ? "—" : `${(value * 100).toFixed(1)}%`
export function relative(value: string, max: bigint) {
    return max ? Number((BigInt(value) * 10000n) / max) / 100 : 0
}
