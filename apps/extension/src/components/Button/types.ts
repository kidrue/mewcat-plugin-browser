import type React from "react"

export interface ButtonProps {
    disabled?: boolean
    htmlType?: "button" | "submit" | "reset"
    type?: "primary" | "secondary" | "error" | "ghost"
    size?: "sm" | "md" | "lg"
    children?: React.ReactNode
    onClick?: () => void
    fullWidth?: boolean
}
