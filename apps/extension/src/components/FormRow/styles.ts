import styled, { css } from "styled-components"

// 卡片内的字段用细线分隔；空间不足时控件换行，避免双列卡片挤压输入区。
export const Row = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-6);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--border-light);

    &:first-child {
        border-top: none;
        padding-top: 0;
    }

    &:last-child {
        padding-bottom: 0;
    }

    @media (max-width: 900px) {
        flex-direction: column;
        gap: var(--space-2);
    }
`

export const Term = styled.div`
    flex: 0 0 208px;
    padding-top: 2px;

    @media (max-width: 900px) {
        flex: none;
        padding-top: 0;
    }
`

export const Label = styled.label<{ $required: boolean }>`
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);

    ${({ $required }) =>
        $required &&
        css`
            &::after {
                content: "*";
                margin-left: var(--space-1);
                color: var(--primary-color);
                font-size: var(--font-size-xs);
            }
        `}
`

export const Description = styled.p`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    margin: var(--space-1) 0 0 0;
    line-height: var(--line-height-normal);
`

export const Field = styled.div`
    flex: 1 1 220px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);

    @media (max-width: 900px) {
        flex: none;
        width: 100%;
    }
`

export const CompactRow = styled(Row)`
    @media (min-width: 901px) {
        flex-wrap: nowrap;
        gap: var(--space-4);

        ${Term} {
            flex-basis: min(42%, 208px);
            min-width: 0;
        }

        ${Field} {
            flex: 1 1 0;
        }
    }

    @media (max-width: 900px) {
        ${Term} {
            display: contents;
        }

        ${Description} {
            order: 1;
            margin: 0;
        }
    }
`
