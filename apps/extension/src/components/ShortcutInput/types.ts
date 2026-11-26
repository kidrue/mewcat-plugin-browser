export interface ShortcutInputProps {
    id: string
    label: string
    value: string
    defaultValue: string
    resetLabel: string
    disabled?: boolean
    allowClear?: boolean
    conflictingShortcut?: string
    conflictMessage?: string
    onChange: (value: string) => void
}
