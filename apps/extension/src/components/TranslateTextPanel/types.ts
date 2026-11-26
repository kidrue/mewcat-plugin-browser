import type { SelectionResult } from "@/hooks/useSelectionTranslation"

export interface TranslateTextPanelProps {
    data?: string
    pageTitle?: string
    context?: string
    active?: boolean
    onFinished?: () => void
    onResultChange?: (result: SelectionResult) => void
}
