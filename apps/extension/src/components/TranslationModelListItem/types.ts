import type * as React from "react"

import type { BaseModel } from "@/types/aiModel"

export type TranslationModelListItemProps = {
    id: string
    model: BaseModel
    isEnabled: boolean
    isSelected: boolean
    isDragging: boolean
    onClick: React.MouseEventHandler<HTMLDivElement>
    onToggleEnabled: (enabled: boolean) => void
}
