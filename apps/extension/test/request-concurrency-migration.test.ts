import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { STORAGE_NAMES, toWxtSyncStorageKey } from "../src/constants/storage"
import { defaultExtensionConfig } from "../src/state/constants"
import type { ExtensionConfig } from "../src/types/config"

const configKey = toWxtSyncStorageKey(STORAGE_NAMES.extensionConfig)
const migrationKey = toWxtSyncStorageKey(
    STORAGE_NAMES.requestConcurrencyMigration
)
const values = new Map<string, unknown>()
const mocks = vi.hoisted(() => ({
    register: vi.fn(),
    initializeSentry: vi.fn()
}))
vi.mock("@/background", () => ({ registerBackgroundListeners: mocks.register }))
vi.mock("@/monitoring", () => ({ initializeSentry: mocks.initializeSentry }))

async function connectStorage() {
    const { storage } = await import("#imports")
    vi.spyOn(storage, "getItem").mockImplementation(async key =>
        structuredClone(values.get(key))
    )
    vi.spyOn(storage, "setItem").mockImplementation(async (key, value) => {
        values.set(key, structuredClone(value))
    })
    vi.spyOn(storage, "setItems").mockImplementation(async items => {
        for (const { key, value } of items)
            values.set(key, structuredClone(value))
    })
    return storage
}
const storedConfig = () => values.get(configKey) as ExtensionConfig

beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    values.clear()
    values.set(configKey, {
        ...structuredClone(defaultExtensionConfig),
        maxRequestsPerSecond: 3,
        targetLanguage: "ja"
    })
    await connectStorage()
})
afterEach(() => vi.restoreAllMocks())

describe("one-time request concurrency migration", () => {
    it("retains completion when an older synced client saves only known config fields", async () => {
        const { migrateRequestConcurrency, handleUpdateConfig } = await import(
            "../src/background/messages/update-config"
        )
        await migrateRequestConcurrency()
        await handleUpdateConfig({
            type: "patch",
            updates: { maxRequestsPerSecond: 2 }
        })
        const oldClientConfig = {
            ...structuredClone(defaultExtensionConfig),
            maxRequestsPerSecond: 2,
            targetLanguage: "ja"
        }
        values.set(configKey, oldClientConfig)
        await migrateRequestConcurrency()
        expect(storedConfig().maxRequestsPerSecond).toBe(2)
    })

    it.each([1, 3, 8, 24])(
        "sets saved concurrency %s to eight and keeps other settings",
        async previous => {
            values.set(configKey, {
                ...storedConfig(),
                maxRequestsPerSecond: previous
            })
            const { migrateRequestConcurrency } = await import(
                "../src/background/messages/update-config"
            )
            await migrateRequestConcurrency()
            expect(storedConfig()).toMatchObject({
                maxRequestsPerSecond: 8,
                targetLanguage: "ja"
            })
            expect(values.get(migrationKey)).toBe(1)
            const { storage } = await import("#imports")
            expect(
                vi
                    .mocked(storage.setItems)
                    .mock.calls[0][0].map(item => item.key)
            ).toEqual([
                "sync:extension-config",
                "sync:request-concurrency-migration"
            ])
        }
    )

    it("records a fresh installation so later user edits are retained", async () => {
        values.clear()
        const { migrateRequestConcurrency, handleUpdateConfig } = await import(
            "../src/background/messages/update-config"
        )
        await migrateRequestConcurrency()
        await handleUpdateConfig({
            type: "patch",
            updates: { maxRequestsPerSecond: 2 }
        })
        await migrateRequestConcurrency()
        expect(storedConfig()).toMatchObject({
            maxRequestsPerSecond: 2
        })
        expect(values.get(migrationKey)).toBe(1)
    })

    it("does not reset a user edit after the worker restarts", async () => {
        const first = await import("../src/background/messages/update-config")
        await first.migrateRequestConcurrency()
        await first.handleUpdateConfig({
            type: "patch",
            updates: { maxRequestsPerSecond: 4 }
        })
        vi.resetModules()
        await connectStorage()
        const restarted = await import(
            "../src/background/messages/update-config"
        )
        await restarted.migrateRequestConcurrency()
        expect(storedConfig()).toMatchObject({
            maxRequestsPerSecond: 4
        })
        expect(values.get(migrationKey)).toBe(1)
    })

    it("serializes migration with simultaneous configuration writes", async () => {
        const { migrateRequestConcurrency, handleUpdateConfig } = await import(
            "../src/background/messages/update-config"
        )
        await Promise.all([
            migrateRequestConcurrency(),
            handleUpdateConfig({
                type: "patch",
                updates: { maxRequestsPerSecond: 2 }
            }),
            handleUpdateConfig({
                type: "patch",
                updates: { detectedLanguage: "en" }
            }),
            migrateRequestConcurrency()
        ])
        expect(storedConfig()).toMatchObject({
            maxRequestsPerSecond: 2,
            detectedLanguage: "en",
            targetLanguage: "ja"
        })
        expect(values.get(migrationKey)).toBe(1)
    })

    it("retries a failed atomic write without leaving a completion marker", async () => {
        const { storage } = await import("#imports")
        vi.mocked(storage.setItems).mockRejectedValueOnce(
            new Error("storage unavailable")
        )
        const { migrateRequestConcurrency } = await import(
            "../src/background/messages/update-config"
        )
        await expect(migrateRequestConcurrency()).rejects.toThrow(
            "storage unavailable"
        )
        expect(storedConfig().maxRequestsPerSecond).toBe(3)
        expect(values.has(migrationKey)).toBe(false)
        await migrateRequestConcurrency()
        expect(storedConfig()).toMatchObject({
            maxRequestsPerSecond: 8
        })
        expect(values.get(migrationKey)).toBe(1)
    })

    it("does not repeat a migration recorded by a newer version", async () => {
        values.set(configKey, {
            ...storedConfig(),
            maxRequestsPerSecond: 2
        })
        values.set(migrationKey, 2)
        const { migrateRequestConcurrency } = await import(
            "../src/background/messages/update-config"
        )
        await migrateRequestConcurrency()
        expect(storedConfig()).toMatchObject({
            maxRequestsPerSecond: 2
        })
        expect(values.get(migrationKey)).toBe(2)
    })

    it("queues the startup migration before registering configuration handlers", async () => {
        vi.doMock("#imports", async importOriginal => ({
            ...(await importOriginal<typeof import("#imports")>()),
            defineBackground: (callback: () => void) => callback
        }))
        let updated: Promise<ExtensionConfig> | undefined
        const { handleUpdateConfig } = await import(
            "../src/background/messages/update-config"
        )
        mocks.register.mockImplementation(() => {
            updated = handleUpdateConfig({
                type: "patch",
                updates: { detectedLanguage: "en" }
            })
        })
        try {
            const { default: main } = await import(
                "../src/entrypoints/background"
            )
            main()
            await updated
            expect(storedConfig()).toMatchObject({
                maxRequestsPerSecond: 8,
                detectedLanguage: "en"
            })
            expect(values.get(migrationKey)).toBe(1)
        } finally {
            vi.doUnmock("#imports")
        }
    })
})
