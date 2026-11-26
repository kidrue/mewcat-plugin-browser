import type { BaseModel } from "@/types/aiModel"

export interface ModelSelectionOption {
    value: string
    label: string
}

export interface ModelDiscoveryFieldProps {
    model: BaseModel
    onChange: (
        modelName: string,
        capabilities: BaseModel["capabilities"] | undefined
    ) => void
}
