import type { MewCatUsageDetails } from "@mewcat/client"

export type MewCatUsageResponse =
    | { success: true; data: MewCatUsageDetails }
    | { success: false }
