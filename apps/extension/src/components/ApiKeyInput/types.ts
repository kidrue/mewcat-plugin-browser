export interface ApiKeyInputProps {
    id?: string
    label: string
    value: string
    disabledVisitable?: boolean
    disabled?: boolean
    onChange: (value: string) => void
    placeholder?: string
    helperText?: string
    helperLink?: {
        text: string
        url: string
    }
    onTest?: (apiKey: string) => Promise<boolean>
    testButtonText?: string
}
