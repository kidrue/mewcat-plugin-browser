import {
    createIdentity,
    open,
    seal,
    validateRequest,
    type Identity
} from "@mewcat/protocol"
import { beforeAll, describe, expect, it } from "vitest"

describe("加密协议", () => {
    let sender: Identity
    let recipient: Identity
    beforeAll(async () => {
        sender = await createIdentity()
        recipient = await createIdentity()
    })
    const request = () => ({
        v: 1 as const,
        method: "POST" as const,
        path: "/v1/translate",
        timestamp: Date.now(),
        nonce: crypto.randomUUID(),
        data: { texts: ["秘密原文"] }
    })

    it("仅接收方能解密并校验发送方签名，私钥默认不可导出", async () => {
        const payload = request()
        const wire = await seal(
            payload,
            sender.signing.privateKey,
            recipient.encryption.publicKey,
            "sender",
            "recipient"
        )
        expect(wire).not.toContain("秘密原文")
        expect(
            await open(
                wire,
                recipient.encryption.privateKey,
                sender.signing.publicKey,
                "sender",
                "recipient"
            )
        ).toEqual(payload)
        await expect(
            open(
                wire,
                sender.encryption.privateKey,
                sender.signing.publicKey,
                "sender",
                "recipient"
            )
        ).rejects.toThrow()
        await expect(
            crypto.subtle.exportKey("jwk", sender.signing.privateKey)
        ).rejects.toThrow()
    })

    it("拒绝签名冒充、密文篡改和错误 key id", async () => {
        const wire = await seal(
            request(),
            sender.signing.privateKey,
            recipient.encryption.publicKey,
            "sender",
            "recipient"
        )
        await expect(
            open(
                wire,
                recipient.encryption.privateKey,
                recipient.signing.publicKey,
                "sender",
                "recipient"
            )
        ).rejects.toThrow()
        const parts = wire.split(".")
        const body = parts[3]!
        parts[3] = (body[0] === "a" ? "b" : "a") + body.slice(1)
        await expect(
            open(
                parts.join("."),
                recipient.encryption.privateKey,
                sender.signing.publicKey,
                "sender",
                "recipient"
            )
        ).rejects.toThrow()
        await expect(
            open(
                wire,
                recipient.encryption.privateKey,
                sender.signing.publicKey,
                "different",
                "recipient"
            )
        ).rejects.toThrow()
    })

    it("绑定请求方法、路径、时间和 nonce", () => {
        const data = request()
        expect(
            validateRequest(data, "/v1/translate", data.timestamp, 300_000)
                .nonce
        ).toBe(data.nonce)
        expect(() =>
            validateRequest(data, "/v1/usage", data.timestamp, 300_000)
        ).toThrow()
        expect(() =>
            validateRequest(
                { ...data, method: "GET" },
                "/v1/translate",
                data.timestamp,
                300_000
            )
        ).toThrow()
        for (const offset of [-300_001, 300_001]) {
            expect(() =>
                validateRequest(
                    data,
                    "/v1/translate",
                    data.timestamp + offset,
                    300_000
                )
            ).toThrow()
        }
        expect(() =>
            validateRequest(
                { ...data, nonce: "short" },
                "/v1/translate",
                data.timestamp,
                300_000
            )
        ).toThrow()
    })
})
