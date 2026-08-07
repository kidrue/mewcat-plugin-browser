import React from "react"
import styled from "styled-components"

interface NumberInputProps {
    value: number | string
    onChange: (value: number) => void
    placeholder?: string
    min?: number
    max?: number
    className?: string
}

const Input = styled.input`
    width: 100%;
    padding: 0 var(--space-3);
    height: 36px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family);
    background: var(--bg-secondary);
    color: var(--text-primary);
    transition: all var(--transition-fast);

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }

    &::placeholder {
        color: var(--text-tertiary);
    }

    &:hover {
        border-color: var(--gray-400);
    }

    &:disabled {
        background: var(--gray-100);
        cursor: not-allowed;
    }

    /* Chrome, Safari, Edge, Opera */
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    /* Firefox */
    &[type="number"] {
        -moz-appearance: textfield;
    }
`

const NumberInput: React.FC<NumberInputProps> = ({
    value,
    onChange,
    placeholder,
    min,
    max,
    className
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value) || 0
        if (min !== undefined && newValue < min) {
            return
        }
        if (max !== undefined && newValue > max) {
            return
        }
        onChange(newValue)
    }

    return (
        <Input
            type="number"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            min={min}
            max={max}
            className={className}
        />
    )
}

export default NumberInput
