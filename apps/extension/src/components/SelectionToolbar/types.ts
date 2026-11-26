import type { SelectionResult } from "@/hooks/useSelectionTranslation"

export interface SelectionToolbarProps {
    result: SelectionResult
    active: boolean
    pinned: boolean
    onTogglePinned: () => void
    onClose: () => void
}

export type ActionIconProps = { name: "copy" | "check" | "pin" | "close" }
