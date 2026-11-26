import React from "react"

import { authorDevices } from "./constants"
import { Mono } from "./styles"
import type { DeviceIdProps } from "./types"

export const DeviceId: React.FC<DeviceIdProps> = ({
    clientId,
    truncated = false
}) => {
    const label = clientId
        ? truncated
            ? `${clientId.slice(0, 8)}…${clientId.slice(-4)}`
            : clientId
        : "未认证"
    return (
        <>
            <Mono title={clientId ?? undefined}>{label}</Mono>
            {clientId && authorDevices.has(clientId.toLowerCase()) && (
                <span
                    aria-label="作者 kidrue 的设备"
                    style={{ marginLeft: 6, color: "var(--primary-color)" }}
                >
                    kidrue
                </span>
            )}
        </>
    )
}
