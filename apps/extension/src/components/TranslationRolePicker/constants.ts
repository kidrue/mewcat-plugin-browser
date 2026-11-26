import { AiRoleOptions } from "@/constants/aiRole"

export const roleLabels = new Map(
    AiRoleOptions.map(({ value, label }) => [value, label])
)
