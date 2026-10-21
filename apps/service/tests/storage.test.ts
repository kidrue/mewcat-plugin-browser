import "fake-indexeddb/auto"

import { loadClientState, saveClientState } from "@mewcat/client"
import { createIdentity, open, seal } from "@mewcat/protocol"
import { describe, expect, it } from "vitest"

describe("扩展身份持久化", () => {
    it("IndexedDB 往返保留不可导出的 CryptoKey 和独立服务身份", async () => {
        const origin = "https://translate.example.com"
        const identity = await createIdentity()
        expect(await loadClientState(origin)).toBeUndefined()
        await saveClientState(origin, { identity, clientId: "test-client" })
        const restored = await loadClientState(origin)
        expect(restored?.clientId).toBe("test-client")
        expect(restored?.identity.signing.privateKey.extractable).toBe(false)
        const wire = await seal(
            { value: "still works" },
            restored!.identity.signing.privateKey,
            identity.encryption.publicKey,
            "sender",
            "recipient"
        )
        expect(
            await open(
                wire,
                restored!.identity.encryption.privateKey,
                identity.signing.publicKey,
                "sender",
                "recipient"
            )
        ).toEqual({ value: "still works" })
        expect(
            await loadClientState("https://other.example.com")
        ).toBeUndefined()
    })
})
