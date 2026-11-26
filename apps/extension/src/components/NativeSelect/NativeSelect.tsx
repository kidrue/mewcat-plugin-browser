import React, { useCallback } from "react"

import { SelectArrow, SelectWrapper, StyledSelect } from "./styles"
import type { NativeSelectProps } from "./types"

export const NativeSelect: React.FC<NativeSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = "请选择",
    disabled,
    className,
    size = "md",
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy
}) => {
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onChange(e.target.value)
        },
        [onChange]
    )

    return (
        <SelectWrapper className={className}>
            <StyledSelect
                id={id}
                value={String(value)}
                onChange={handleChange}
                disabled={disabled}
                $size={size}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
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
