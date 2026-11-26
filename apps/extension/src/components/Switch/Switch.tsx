import React, { useCallback } from "react"

import { SwitchContainer, SwitchInput, SwitchTrack } from "./styles"
import type { SwitchProps } from "./types"

export const Switch: React.FC<SwitchProps> = ({
    checked,
    onChange,
    disabled = false,
    className,
    size = "md",
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy
}) => {
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!disabled) {
                onChange(e.target.checked)
            }
        },
        [disabled, onChange]
    )

    return (
        <SwitchContainer
            $disabled={disabled}
            $size={size}
            className={className}
        >
            <SwitchInput
                id={id}
                type="checkbox"
                checked={checked}
                onChange={handleChange}
                disabled={disabled}
                role="switch"
                aria-checked={checked}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
            />
            <SwitchTrack $checked={checked} $size={size} />
        </SwitchContainer>
    )
}
