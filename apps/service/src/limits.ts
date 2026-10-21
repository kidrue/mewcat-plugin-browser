import { createHmac } from "node:crypto"
import ipaddr from "ipaddr.js"

import type { Config } from "./config.js"
import type { Bucket } from "./store.js"

export function hashIp(ip: string, secret: string): string {
    const address = ipaddr.process(ip)
    const bytes = address.toByteArray()
    // 同一 IPv6 /64 视为一个来源，避免通过隐私地址轮换绕过限额。
    const network = address.kind() === "ipv6" ? bytes.slice(0, 8) : bytes
    return createHmac("sha256", secret)
        .update(`${address.kind()}:${network.join(".")}`)
        .digest("hex")
}
export function dayWindow(now = Date.now()) {
    const start = Math.floor(now / 86_400_000) * 86_400_000
    return { id: String(start), expiresAt: new Date(start + 86_400_000) }
}
export const clientDailyKey = (clientId: string, now = Date.now()) =>
    `client:${clientId}:day:${dayWindow(now).id}`
export function feedbackBuckets(
    config: Config,
    clientId: string,
    ipHash: string,
    now = Date.now()
): Bucket[] {
    const hour = Math.floor(now / 3_600_000)
    const expiresAt = new Date((hour + 1) * 3_600_000)
    const day = dayWindow(now)
    return [
        {
            key: `feedback:client:${clientId}:hour:${hour}`,
            amount: 1,
            limit: config.FEEDBACK_CLIENT_REQUESTS_PER_HOUR,
            expiresAt
        },
        {
            key: `feedback:ip:${ipHash}:hour:${hour}`,
            amount: 1,
            limit: config.FEEDBACK_IP_REQUESTS_PER_HOUR,
            expiresAt
        },
        {
            key: `feedback:global:day:${day.id}`,
            amount: 1,
            limit: config.FEEDBACK_GLOBAL_REQUESTS_PER_DAY,
            expiresAt: day.expiresAt
        }
    ]
}
export function translationBuckets(
    config: Config,
    clientId: string,
    ipHash: string,
    characters: number,
    now = Date.now()
): Bucket[] {
    const day = dayWindow(now)
    const minute = Math.floor(now / 60_000)
    const minuteEnd = new Date((minute + 1) * 60_000)
    return [
        {
            key: `client:${clientId}:minute:${minute}`,
            amount: 1,
            limit: config.CLIENT_REQUESTS_PER_MINUTE,
            expiresAt: minuteEnd
        },
        {
            key: `ip:${ipHash}:minute:${minute}`,
            amount: 1,
            limit: config.IP_REQUESTS_PER_MINUTE,
            expiresAt: minuteEnd
        },
        {
            key: clientDailyKey(clientId, now),
            amount: characters,
            limit: config.CLIENT_DAILY_CHARACTERS,
            expiresAt: day.expiresAt
        },
        {
            key: `ip:${ipHash}:day:${day.id}`,
            amount: characters,
            limit: config.IP_DAILY_CHARACTERS,
            expiresAt: day.expiresAt
        },
        {
            key: `global:characters:${day.id}`,
            amount: characters,
            limit: config.GLOBAL_DAILY_CHARACTERS,
            expiresAt: day.expiresAt
        },
        {
            key: `global:requests:${day.id}`,
            amount: 1,
            limit: config.GLOBAL_DAILY_REQUESTS,
            expiresAt: day.expiresAt
        }
    ]
}
