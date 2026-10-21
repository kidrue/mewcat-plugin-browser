import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createStore, type Store } from "../src/store.js"
import { applyMigrations } from "./helpers.js"

describe("持久化防滥用", () => {
    let store: Store
    let directory: string
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), "mewcat-store-"))
        store = createStore(
            `file:${join(directory, "test.db").replaceAll("\\", "/")}`
        )
        await applyMigrations(store)
    })
    afterEach(async () => {
        await store?.db.$disconnect()
        if (directory) await rm(directory, { recursive: true, force: true })
    })

    async function register() {
        return store.registerClient(
            "测试扩展",
            { kty: "EC", crv: "P-256", x: crypto.randomUUID(), y: "test" },
            { kty: "RSA", n: "test", e: "AQAB" }
        )
    }

    it("相同设备可找回 ID，不能换响应公钥或恢复已撤销身份", async () => {
        const signing = { kty: "EC", crv: "P-256", x: "x", y: "y" }
        const encryption = { kty: "RSA", n: "n", e: "AQAB" }
        const registered = await store.registerClient(
            "extension",
            signing,
            encryption
        )
        expect(
            (await store.registerClient("extension", signing, encryption)).id
        ).toBe(registered.id)
        expect(await store.db.client.count()).toBe(1)
        await expect(
            store.registerClient("extension", signing, {
                ...encryption,
                n: "different"
            })
        ).rejects.toMatchObject({ code: "CLIENT_EXISTS" })
        await store.revokeClient(registered.id)
        await expect(
            store.registerClient("extension", signing, encryption)
        ).rejects.toMatchObject({ code: "CLIENT_REVOKED" })
    })

    it("拒绝已撤销设备的请求", async () => {
        const client = await register()
        await store.revokeClient(client.id)
        await expect(
            store.consumeNonce(
                client.id,
                crypto.randomUUID(),
                Date.now() + 600_000
            )
        ).rejects.toMatchObject({ code: "CLIENT_REVOKED" })
    })

    it("迁移删除邀请码结构并保留已有客户端", async () => {
        const legacyDirectory = await mkdtemp(
            join(tmpdir(), "mewcat-migration-")
        )
        const legacyStore = createStore(
            `file:${join(legacyDirectory, "test.db").replaceAll("\\", "/")}`
        )
        const clientId = crypto.randomUUID()
        try {
            await applyMigrations(legacyStore, ["20260920000000_init"])
            await legacyStore.db.$executeRawUnsafe(
                `INSERT INTO "Client" ("id", "name", "signingKey", "encryptionKey", "keyThumbprint", "registrationTokenHash", "revokedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
                clientId,
                "existing",
                '{"kty":"EC"}',
                '{"kty":"RSA"}',
                "signing-thumbprint",
                "legacy-token-hash",
                "2026-09-22T00:00:00.000Z"
            )
            await legacyStore.db.$executeRawUnsafe(
                `INSERT INTO "Invitation" ("tokenHash", "expiresAt") VALUES (?, ?)`,
                "unused-invitation",
                "2026-09-24T00:00:00.000Z"
            )
            await applyMigrations(legacyStore, [
                "20260923000000_remove_invitations"
            ])

            const clients = await legacyStore.db.$queryRawUnsafe<
                Array<{ id: string; name: string; revokedAt: Date }>
            >(`SELECT "id", "name", "revokedAt" FROM "Client"`)
            const columns = await legacyStore.db.$queryRawUnsafe<
                Array<{ name: string }>
            >(`PRAGMA table_info("Client")`)
            const invitationTable = await legacyStore.db.$queryRawUnsafe<
                Array<{ name: string }>
            >(
                `SELECT "name" FROM "sqlite_master" WHERE "type" = 'table' AND "name" = 'Invitation'`
            )
            expect(clients).toEqual([
                {
                    id: clientId,
                    name: "existing",
                    revokedAt: new Date("2026-09-22T00:00:00.000Z")
                }
            ])
            expect(columns.map(column => column.name)).not.toContain(
                "registrationTokenHash"
            )
            expect(invitationTable).toEqual([])
        } finally {
            await legacyStore.db.$disconnect()
            await rm(legacyDirectory, { recursive: true, force: true })
        }
    })

    it("并发重放只允许一个请求，记录在整个有效时间窗口内保留", async () => {
        const client = await register()
        const now = Date.now()
        const nonce = crypto.randomUUID()
        const attempts = await Promise.allSettled(
            [1, 2, 3].map(() =>
                store.consumeNonce(client.id, nonce, now + 600_000)
            )
        )
        expect(
            attempts.filter(result => result.status === "fulfilled")
        ).toHaveLength(1)
        await store.cleanup(now + 300_001)
        await expect(
            store.consumeNonce(client.id, nonce, now + 600_000)
        ).rejects.toMatchObject({ code: "REPLAY_DETECTED" })
        await store.cleanup(now + 600_001)
        expect(await store.db.nonce.count()).toBe(0)
    })

    it("并发额度扣减不超额，某一维超额时所有维度整体回滚", async () => {
        const attempts = await Promise.allSettled(
            [1, 2, 3, 4, 5].map(() =>
                store.consumeBuckets([
                    {
                        key: "device",
                        amount: 1,
                        limit: 10,
                        expiresAt: new Date(Date.now() + 60_000)
                    },
                    {
                        key: "global",
                        amount: 1,
                        limit: 2,
                        expiresAt: new Date(Date.now() + 60_000)
                    }
                ])
            )
        )
        expect(
            attempts.filter(result => result.status === "fulfilled")
        ).toHaveLength(2)
        expect(
            (
                await store.db.usageBucket.findUniqueOrThrow({
                    where: { key: "device" }
                })
            ).used
        ).toBe(2)
        expect(
            (
                await store.db.usageBucket.findUniqueOrThrow({
                    where: { key: "global" }
                })
            ).used
        ).toBe(2)
    })
})
