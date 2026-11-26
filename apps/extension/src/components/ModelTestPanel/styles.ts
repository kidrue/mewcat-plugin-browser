import styled from "styled-components"

export const SCxContainer = styled.div`
    width: 100%;
`

export const SCxProgressBar = styled.div`
    width: 100%;
    height: 4px;
    background: var(--gray-200);
    border-radius: var(--radius-sm);
    margin-top: var(--space-3);
    overflow: hidden;
`

export const SCxProgressFill = styled.div<{ progress: number }>`
    height: 100%;
    width: ${props => props.progress}%;
    background: var(--primary-color);
    border-radius: var(--radius-full);
    transition: width var(--transition-base);
`

export const SCxProgressText = styled.div`
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-align: center;
`

export const SCxSummary = styled.div`
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-4);
`

export const SCxSummaryItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
`

export const SCxSummaryLabel = styled.span`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    font-weight: var(--font-weight-normal);
`

export const SCxSummaryValue = styled.span<{
    type?: "success" | "error" | "normal"
}>`
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: ${props => {
        if (props.type === "success") {
            return "var(--success)"
        }
        if (props.type === "error") {
            return "var(--error)"
        }
        return "var(--text-primary)"
    }};
`

export const SCxResultsContainer = styled.div`
    margin-top: var(--space-4);
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);

    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: var(--gray-100);
        border-radius: var(--radius-sm);
    }

    &::-webkit-scrollbar-thumb {
        background: var(--gray-300);
        border-radius: var(--radius-sm);

        &:hover {
            background: var(--gray-400);
        }
    }
`

export const SCxResultItem = styled.div<{ success: boolean }>`
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-light);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: ${props =>
        props.success ? "var(--success-bg)" : "var(--error-bg)"};
    transition: all var(--transition-fast);

    &:last-child {
        border-bottom: none;
    }

    &:hover {
        background: ${props =>
            props.success ? "var(--success-bg)" : "var(--error-bg)"};
        filter: brightness(0.98);
    }
`

export const SCxResultLeft = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
`

export const SCxModelName = styled.span`
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
`

export const SCxResultText = styled.span`
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`

export const SCxErrorText = styled.span`
    font-size: var(--font-size-xs);
    color: var(--error);
`

export const SCxResultRight = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-1);
    flex-shrink: 0;
`

export const SCxStatusBadge = styled.span<{ success: boolean }>`
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    background: ${props => (props.success ? "var(--success)" : "var(--error)")};
    color: var(--text-inverse);
    line-height: 1;
`

export const SCxDuration = styled.span`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
`
