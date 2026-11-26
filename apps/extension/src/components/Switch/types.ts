import type { SIZES } from "./constants"

export interface SwitchProps {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    className?: string
    size?: "sm" | "md" | "lg"
    id?: string
    "aria-label"?: string
    "aria-labelledby"?: string
    "aria-describedby"?: string
}

export type SizeKey = keyof typeof SIZES
