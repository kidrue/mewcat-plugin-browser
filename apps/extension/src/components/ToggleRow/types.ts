export interface ToggleRowProps {
    title: string
    description: string
    checked: boolean
    onChange: (checked: boolean) => void
    className?: string
}
