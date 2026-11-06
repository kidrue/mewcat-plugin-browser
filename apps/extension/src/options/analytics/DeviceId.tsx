import React from "react"

import { Mono } from "./styles"

// 仅为作者设备添加显示标签；管理员授权仍由服务端独立校验。
const authorDevices = new Set([
    "37156ad6-e1c6-4628-8ec3-55b329f4f1a3",
    "76aa2488-3241-4f38-b0a6-4f5df933417b"
])

export function DeviceId({
    clientId,
    truncated = false
}: {
    clientId?: string | null
    truncated?: boolean
}) {
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
