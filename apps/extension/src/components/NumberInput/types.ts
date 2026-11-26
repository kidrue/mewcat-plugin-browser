export interface NumberInputProps {
    value: number | string
    onChange: (value: number) => void
    placeholder?: string
    min?: number
    max?: number
    className?: string
}
