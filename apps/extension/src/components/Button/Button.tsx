import React from "react"

import { StyledButton } from "./styles"
import type { ButtonProps } from "./types"

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            disabled,
            htmlType,
            type = "primary",
            size = "md",
            children,
            onClick,
            fullWidth = false
        },
        ref
    ) => {
        return (
            <StyledButton
                disabled={disabled}
                type={htmlType}
                ref={ref}
                $variant={type}
                $size={size}
                $fullWidth={fullWidth}
                onClick={onClick}
            >
                {children}
            </StyledButton>
        )
    }
)

Button.displayName = "Button"
