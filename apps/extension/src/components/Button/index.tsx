import React from "react"
import { styled } from "styled-components"

interface ButtonProps {
    disabled?: boolean
    htmlType?: "button" | "submit" | "reset"
    type?: "primary" | "secondary" | "error" | "ghost"
    size?: "sm" | "md" | "lg"
    children?: React.ReactNode
    onClick?: () => void
    fullWidth?: boolean
}

const StyledButton = styled.button<{
    $variant: string
    $size: string
    $fullWidth: boolean
}>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: ${props => (props.$fullWidth ? "100%" : "auto")};
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
    padding: 0 var(--space-4);
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
    font-weight: var(--font-weight-medium);
    line-height: 1;
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: var(--font-family);

    ${props => {
        switch (props.$variant) {
            case "secondary":
                return `
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                    &:hover:not(:disabled) {
                        background: var(--gray-50);
                        border-color: var(--gray-300);
                    }
                `
            case "error":
                return `
                    background: var(--error);
                    color: var(--text-inverse);
                    &:hover:not(:disabled) {
                        background: var(--primary-hover);
                    }
                `
            case "ghost":
                return `
                    background: transparent;
                    color: var(--text-secondary);
                    &:hover:not(:disabled) {
                        background: var(--gray-100);
                        color: var(--text-primary);
                    }
                `
            default:
                return `
                    background: var(--primary-color);
                    color: var(--text-inverse);
                    &:hover:not(:disabled) {
                        background: var(--primary-hover);
                        box-shadow: var(--shadow-primary-sm);
                    }
                `
        }
    }}

    &:hover:not(:disabled) {
        transform: translateY(-1px);
    }

    &:active:not(:disabled) {
        transform: translateY(0);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
    }
`

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
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

export default Button
