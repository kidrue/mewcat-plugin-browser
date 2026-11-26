import type React from "react"

export type TooltipPosition = "top" | "bottom" | "left" | "right"

export type TooltipTrigger = "hover" | "click" | "both"

export interface TooltipProps {
    content: React.ReactNode
    children: React.ReactElement
    position?: TooltipPosition
    trigger?: TooltipTrigger
    delay?: number
    offset?: number
    disabled?: boolean
    className?: string
    width?: number | string
}
