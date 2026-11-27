import styled from "styled-components"

import type { DiscoveredModel } from "@/features/model-management"

export const FieldStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
`

export const FieldMeta = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 20px;
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
`

export const CapabilityBadge = styled.span<{
    $vision: DiscoveredModel["vision"]
}>`
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-2);
    border-radius: 999px;
    color: ${props =>
        props.$vision === "supported"
            ? "var(--success)"
            : "var(--text-secondary)"};
    background: var(--bg-tertiary);
`

export const RefreshButton = styled.button`
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--primary-color);
    font: inherit;
    cursor: pointer;

    &:disabled {
        color: var(--text-tertiary);
        cursor: default;
    }
`

export const ErrorText = styled.div`
    color: var(--error);
    font-size: var(--font-size-xs);
`
