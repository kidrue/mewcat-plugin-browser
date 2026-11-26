import type { AiModel_Platform_Enum } from "@/types"

export interface AddModelProps {
    onItemClick: (platform: AiModel_Platform_Enum) => void
    label?: string
}
