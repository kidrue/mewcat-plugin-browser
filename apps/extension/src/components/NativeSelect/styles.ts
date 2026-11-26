import styled from "styled-components"

export const SelectWrapper = styled.div`
    position: relative;
    width: 100%;
`

export const SelectArrow = styled.span`
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--text-tertiary);
    transition: transform var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
        width: 12px;
        height: 12px;
        display: block;
    }
`

export const StyledSelect = styled.select<{ $size: string }>`
    box-sizing: border-box;
    width: 100%;
    height: ${props => {
        switch (props.$size) {
            case "sm":
                return "28px"
            case "lg":
                return "44px"
            default:
                return "36px"
        }
    }};
    padding: 0 var(--space-3);
    padding-right: var(--space-8);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: ${props => {
        switch (props.$size) {
            case "sm":
                return "var(--font-size-xs)"
            case "lg":
                return "var(--font-size-base)"
            default:
                return "var(--font-size-sm)"
        }
    }};
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: var(--font-family);
    appearance: none;
    line-height: 1;

    &:hover:not(:disabled) {
        border-color: var(--gray-400);
    }

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background: var(--gray-100);
    }

    option {
        padding: var(--space-2) var(--space-3);
        background: var(--bg-secondary);
        color: var(--text-primary);
    }
`
