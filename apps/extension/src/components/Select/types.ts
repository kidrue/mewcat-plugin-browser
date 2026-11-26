import type { Placement } from "@floating-ui/react"

export interface SelectOption {
    value: string | number
    label: string
}

export interface SelectProps {
    value: string | number | string[] | number[]
    options: SelectOption[]
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
    disabled?: boolean
    id?: string
    "aria-label"?: string
    multiple?: boolean
    withinPortal?: boolean
    placement?: Placement
    onChange: (value: string | number | string[] | number[]) => void
}
