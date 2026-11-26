interface Option {
    value: string | number
    label: string
}

export interface NativeSelectProps {
    value: string | number
    onChange: (value: string) => void
    options: Option[]
    placeholder?: string
    disabled?: boolean
    className?: string
    size?: "sm" | "md" | "lg"
    id?: string
    "aria-label"?: string
    "aria-labelledby"?: string
    "aria-describedby"?: string
}
