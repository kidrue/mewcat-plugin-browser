export interface FormRowProps {
    label: string
    description?: string
    compact?: boolean
    required?: boolean
    controlId?: string
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
}
