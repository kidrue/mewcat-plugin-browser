import { describe, expect, it } from "vitest"

import { loadConfig } from "../src/config.js"
import { hashIp, translationBuckets } from "../src/limits.js"

describe("额度来源边界", () => {
    it("IPv6 /64 和 IPv4 映射地址不能通过轮换绕过 IP 限制", () => {
        expect(hashIp("2001:db8:1:2::1", "salt")).toBe(
            hashIp("2001:db8:1:2:abcd::ffff", "salt")
        )
        expect(hashIp("::ffff:192.0.2.1", "salt")).toBe(
            hashIp("192.0.2.1", "salt")
        )
        expect(hashIp("2001:db8:1:3::1", "salt")).not.toBe(
            hashIp("2001:db8:1:2::1", "salt")
        )
        expect(hashIp("192.0.2.1", "other-salt")).not.toBe(
            hashIp("192.0.2.1", "salt")
        )
    })
    it("UTC 日边界刷新每日额度，不能改客户端 ID 绕过全站额度", () => {
        const config = loadConfig({
            SILICONFLOW_API_KEY: "test",
            SILICONFLOW_MODEL: "test"
        })
        const before = translationBuckets(
            config,
            "a",
            "same-ip",
            10,
            Date.parse("2026-09-20T23:59:59Z")
        )
        const sameWindow = translationBuckets(
            config,
            "b",
            "other-ip",
            10,
            Date.parse("2026-09-20T23:59:59Z")
        )
        const after = translationBuckets(
            config,
            "a",
            "same-ip",
            10,
            Date.parse("2026-09-21T00:00:00Z")
        )
        expect(before.filter(item => item.key.startsWith("global:"))).toEqual(
            sameWindow.filter(item => item.key.startsWith("global:"))
        )
        expect(
            before
                .map(item => item.key)
                .some(key => after.some(item => item.key === key))
        ).toBe(false)
    })
})
