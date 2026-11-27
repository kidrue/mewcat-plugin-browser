import type { Placement } from "@floating-ui/react"
import type { ComponentPropsWithRef, ReactElement } from "react"

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
    renderTrigger?: (props: ComponentPropsWithRef<"button">) => ReactElement
    dropdownWidth?: number
    onChange: (value: string | number | string[] | number[]) => void
}
