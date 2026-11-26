import React, { useCallback } from "react"

import { Input } from "./styles"
import type { NumberInputProps } from "./types"

export const NumberInput: React.FC<NumberInputProps> = ({
    value,
    onChange,
    placeholder,
    min,
    max,
    className
}) => {
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = parseInt(e.target.value) || 0
            if (min !== undefined && newValue < min) {
                return
            }
            if (max !== undefined && newValue > max) {
                return
            }
            onChange(newValue)
        },
        [max, min, onChange]
    )

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
