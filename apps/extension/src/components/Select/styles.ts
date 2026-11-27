import styled from "styled-components"

import { hideScrollBar } from "../../styles/scroll"

export const SelectContainer = styled.div<{ $customTrigger: boolean }>`
    position: relative;
    width: ${({ $customTrigger }) => ($customTrigger ? "fit-content" : "100%")};
`

export const SelectButton = styled.button`
    width: 100%;
    height: var(--select-trigger-height, 36px);
    padding: 0 var(--space-3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--options-input-background, var(--bg-secondary));
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);

    &:hover {
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
    }
`

export const SelectText = styled.span`
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`

export const ArrowIcon = styled.span<{ $isOpen: boolean }>`
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--space-2);
    transition: transform var(--transition-fast);
    transform: ${props => (props.$isOpen ? "rotate(180deg)" : "rotate(0deg)")};
    color: var(--text-tertiary);

    svg {
        width: 14px;
        height: 14px;
    }
`

export const Dropdown = styled.div<{ width: number }>`
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    border-radius: var(--radius-lg);
    z-index: var(--z-dropdown);
    width: ${({ width }) => width}px;
    max-width: calc(100vw - 2 * var(--space-2));
    max-height: 300px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`

export const SearchHeader = styled.div`
    flex-shrink: 0;
    padding: var(--space-2);
    border-bottom: 1px solid var(--border-color);
`

export const SearchInput = styled.input`
    box-sizing: border-box;
    width: 100%;
    height: 32px;
    padding: 0 var(--space-2);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }
`

export const OptionList = styled.div`
    min-height: 0;
    overflow-y: auto;
    ${hideScrollBar}
`

export const EmptyResult = styled.div`
    padding: var(--space-3);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
`

export const Option = styled.button<{ $isSelected: boolean }>`
    width: 100%;
    border: 0;
    text-align: left;
    font-family: inherit;
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: ${props =>
        props.$isSelected ? "var(--primary-color)" : "var(--text-primary)"};
    background: ${props =>
        props.$isSelected ? "var(--seal-wash)" : "transparent"};
    /* 选中不只靠颜色：左侧压一道朱砂 */
    box-shadow: ${props =>
        props.$isSelected ? "inset 3px 0 0 var(--primary-color)" : "none"};
    display: flex;
    align-items: center;
    gap: var(--space-2);
    transition: background var(--transition-fast);

    &:hover,
    &:focus-visible {
        background: ${props =>
            props.$isSelected ? "var(--seal-wash)" : "var(--bg-tertiary)"};
    }
`

export const Checkbox = styled.span<{ $checked: boolean }>`
    width: 14px;
    height: 14px;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    border: 1px solid var(--border-color);
    background: ${props =>
        props.$checked ? "var(--primary-color)" : "transparent"};
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
`
