import type { DeviceActivityRequest } from "@/messaging/protocol"

export type ActivitySettingRequest = Exclude<
    DeviceActivityRequest,
    { type: "page-translated" }
>
