import { styled } from "styled-components"

export const ModelItem = styled.div<{ $selected: boolean }>`
    min-height: 58px;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: ${props =>
        props.$selected ? "var(--seal-wash)" : "transparent"};
    color: ${props =>
        props.$selected ? "var(--primary-color)" : "var(--text-primary)"};
    /* 蓝色侧标提示当前编辑的模型，列表项保持轻量。 */
    box-shadow: ${props =>
        props.$selected ? "inset 3px 0 0 var(--primary-color)" : "none"};
    transition:
        background var(--transition-fast),
        box-shadow var(--transition-fast);

    &:hover {
        background: ${props =>
            props.$selected ? "var(--seal-wash)" : "var(--bg-tertiary)"};
    }
`

export const ModelItemContent = styled.div`
    flex: 1;
    min-width: 0;
`

export const ModelItemTitle = styled.div`
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    overflow-wrap: anywhere;
`

export const ModelItemSubtitle = styled.div`
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`

export const ModelItemActions = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
`

export const StatusDot = styled.div<{ $enabled: boolean }>`
    width: 6px;
    height: 6px;
    background: ${props =>
        props.$enabled ? "var(--jade)" : "var(--gray-300)"};
    border-radius: var(--radius-full);
    flex-shrink: 0;
`
