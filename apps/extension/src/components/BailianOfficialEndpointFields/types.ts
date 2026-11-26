import type { BaseModel } from "@/types/aiModel"

export interface BailianOfficialEndpointFieldsProps {
    model: BaseModel
    onEndpointChange: (officialEndpointId: string) => void
}
