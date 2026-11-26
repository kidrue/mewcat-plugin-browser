import type { AiRole } from "@/types/config"

export interface TranslationRolePickerProps {
    value: AiRole
    disabled: boolean
    onChange: (role: AiRole) => void
}

export interface PinnedRoleTagProps {
    role: AiRole
    selected: boolean
    disabled: boolean
    onSelect: (role: AiRole) => void
    onRemove: (role: AiRole, restoreFocus: boolean) => void
}
