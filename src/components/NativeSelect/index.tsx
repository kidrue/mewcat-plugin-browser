import React from "react"
import styled from "styled-components"

interface Option {
    value: string | number
    label: string
}

interface NativeSelectProps {
    value: string | number
    onChange: (value: string) => void
    options: Option[]
    placeholder?: string
    disabled?: boolean
    className?: string
    size?: "sm" | "md" | "lg"
}

const SelectWrapper = styled.div`
    position: relative;
    width: 100%;
`

const SelectArrow = styled.span`
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

const StyledSelect = styled.select<{ $size: string }>`
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

const NativeSelect: React.FC<NativeSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = "请选择",
    disabled,
    className,
    size = "md"
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value)
    }

    return (
        <SelectWrapper className={className}>
            <StyledSelect
                value={String(value)}
                onChange={handleChange}
                disabled={disabled}
                $size={size}
            >
                {placeholder && !value && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map(option => (
                    <option
                        key={String(option.value)}
                        value={String(option.value)}
                    >
                        {option.label}
                    </option>
                ))}
            </StyledSelect>
            <SelectArrow>
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </SelectArrow>
        </SelectWrapper>
    )
}

export default NativeSelect
