import { createStore } from "jotai/vanilla"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { defaultExtensionConfig } from "../src/state/constants"
import { AiModel_Platform_Enum } from "../src/types/aiModel"
import type { ExtensionConfig } from "../src/types/config"

vi.mock("@/messaging", () => import("./mocks/config-messaging"))

describe("config persistence across extension contexts", () => {
    let persisted: ExtensionConfig

    beforeEach(async () => {
        vi.resetModules()
        const { storage } = await import("#imports")
        const listeners = new Set<(value: ExtensionConfig) => void>()
        vi.spyOn(storage, "watch").mockImplementation((_key, callback) => {
            listeners.add(callback)
            return () => {
                listeners.delete(callback)
            }
        })
        persisted = {
            ...structuredClone(defaultExtensionConfig),
            aiModelList: [
                {
                    id: "vision",
                    type: AiModel_Platform_Enum.OPENAI,
                    enabled: true,
                    name: "Vision",
                    params: {
                        apiKey: "test-key",
                        modelName: "gpt-4o",
                        isOfficial: true
                    }
                }
            ],
            imageTranslationModelId: "vision",
            imageTranslationModelName: "gpt-4o"
        }
        vi.spyOn(storage, "getItem").mockImplementation(async () =>
            structuredClone(persisted)
        )
        vi.spyOn(storage, "setItem").mockImplementation(async (_key, value) => {
            persisted = structuredClone(value as ExtensionConfig)
            for (const callback of listeners)
                callback(structuredClone(persisted))
        })
    })

    afterEach(() => vi.restoreAllMocks())

    it.each(["dot", "shift", "ctrl"] as const)(
        "keeps %s when an unsubscribed initializer detects the page language",
        async mode => {
            const { configAtom, updateConfigAtom } = await import(
                "../src/state/config"
            )
            const options = createStore()
            const initializer = createStore()
            await Promise.all([
                options.get(configAtom),
                initializer.get(configAtom)
            ])

            await options.set(updateConfigAtom, {
                selectionTriggerMode: mode,
                selectionInteractionMode: "hover",
                enableImageTranslateButton: true
            })
            await initializer.set(updateConfigAtom, { detectedLanguage: "en" })

            expect(persisted).toMatchObject({
                selectionTriggerMode: mode,
                selectionInteractionMode: "hover",
                enableImageTranslateButton: true,
                detectedLanguage: "en"
            })
        }
    )

    it("preserves independent edits submitted concurrently by two contexts", async () => {
        const { configAtom, updateConfigAtom } = await import(
            "../src/state/config"
        )
        const options = createStore()
        const page = createStore()
        await Promise.all([options.get(configAtom), page.get(configAtom)])

        await Promise.all([
            options.set(updateConfigAtom, { selectionTriggerMode: "shift" }),
            page.set(updateConfigAtom, { detectedLanguage: "ja" })
        ])

        expect(persisted).toMatchObject({
            selectionTriggerMode: "shift",
            detectedLanguage: "ja"
        })
    })

    it("merges model fields against persistence without reverting another context's edits", async () => {
        const { configAtom, updateConfigAtom, updateAiModelConfigAtom } =
            await import("../src/state/config")
        const first = createStore()
        const second = createStore()
        await Promise.all([first.get(configAtom), second.get(configAtom)])
        await first.set(updateAiModelConfigAtom, {
            id: "vision",
            params: { apiKey: "new-key" }
        })
        await Promise.all([
            second.set(updateAiModelConfigAtom, {
                id: "vision",
                name: "Renamed"
            }),
            first.set(updateConfigAtom, { selectionTriggerMode: "ctrl" })
        ])
        expect(persisted.aiModelList[0]).toMatchObject({
            name: "Renamed",
            params: { apiKey: "new-key", modelName: "gpt-4o" }
        })
        expect(persisted.selectionTriggerMode).toBe("ctrl")
    })

    it("does not publish failed saves and continues processing later updates", async () => {
        const { configAtom, updateConfigAtom } = await import(
            "../src/state/config"
        )
        const { storage } = await import("#imports")
        const store = createStore()
        await store.get(configAtom)
        vi.mocked(storage.setItem).mockRejectedValueOnce(
            new Error("quota exceeded")
        )
        await expect(
            store.set(updateConfigAtom, { selectionTriggerMode: "shift" })
        ).rejects.toThrow("quota exceeded")
        expect((await store.get(configAtom)).selectionTriggerMode).toBe(
            "direct"
        )
        await store.set(updateConfigAtom, { selectionTriggerMode: "ctrl" })
        expect(persisted.selectionTriggerMode).toBe("ctrl")
    })

    it("does not consume write quota for repeated language detection or missing model edits", async () => {
        const { updateConfigAtom, updateAiModelConfigAtom } = await import(
            "../src/state/config"
        )
        const { storage } = await import("#imports")
        const store = createStore()
        await store.set(updateConfigAtom, { detectedLanguage: "en" })
        vi.mocked(storage.setItem).mockClear()
        await store.set(updateConfigAtom, { detectedLanguage: "en" })
        await store.set(updateAiModelConfigAtom, {
            id: "deleted",
            name: "Missing"
        })
        expect(storage.setItem).not.toHaveBeenCalled()
    })

    it("loads the latest saved settings after the worker restarts", async () => {
        const { handleUpdateConfig } = await import(
            "../src/background/messages/update-config"
        )
        await handleUpdateConfig({
            type: "patch",
            updates: { selectionTriggerMode: "shift" }
        })
        vi.resetModules()
        const { storage } = await import("#imports")
        vi.spyOn(storage, "getItem").mockImplementation(async () =>
            structuredClone(persisted)
        )
        vi.spyOn(storage, "setItem").mockImplementation(async (_key, value) => {
            persisted = value as ExtensionConfig
        })
        const restarted = await import(
            "../src/background/messages/update-config"
        )
        await restarted.handleUpdateConfig({
            type: "patch",
            updates: { detectedLanguage: "fr" }
        })
        expect(persisted).toMatchObject({
            selectionTriggerMode: "shift",
            detectedLanguage: "fr"
        })
    })

    it("does not let a delayed mount read replace a successful update", async () => {
        const { configAtom, updateConfigAtom } = await import(
            "../src/state/config"
        )
        const { storage } = await import("#imports")
        const store = createStore()
        await store.get(configAtom)
        const old = structuredClone(persisted)
        vi.mocked(storage.watch).mockImplementation(() => () => undefined)
        let finishRead: (value: ExtensionConfig) => void = () => undefined
        vi.mocked(storage.getItem).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finishRead = resolve
                })
        )
        const unsubscribe = store.sub(configAtom, () => undefined)
        try {
            await store.set(updateConfigAtom, { selectionTriggerMode: "shift" })
            finishRead(old)
            await new Promise(resolve => setTimeout(resolve, 0))
            expect((await store.get(configAtom)).selectionTriggerMode).toBe(
                "shift"
            )
        } finally {
            unsubscribe()
        }
    })

    it("keeps a newer storage notification when an older save response arrives late", async () => {
        const { configAtom, updateConfigAtom } = await import(
            "../src/state/config"
        )
        const messaging = await import("@/messaging")
        const send = messaging.sendMessage
        let release: () => void = () => undefined
        let notifySaved: () => void = () => undefined
        const saved = new Promise<void>(resolve => {
            notifySaved = resolve
        })
        const delayed = new Promise<void>(resolve => {
            release = resolve
        })
        vi.spyOn(messaging, "sendMessage").mockImplementationOnce(
            async (...args) => {
                const result = await send(...args)
                notifySaved()
                await delayed
                return result
            }
        )
        const first = createStore()
        const second = createStore()
        const unsubscribe = first.sub(configAtom, () => undefined)
        try {
            await first.get(configAtom)
            const oldSave = first.set(updateConfigAtom, {
                selectionTriggerMode: "shift"
            })
            await saved
            await second.set(updateConfigAtom, { selectionTriggerMode: "ctrl" })
            release()
            await oldSave
            expect((await first.get(configAtom)).selectionTriggerMode).toBe(
                "ctrl"
            )
            expect(persisted.selectionTriggerMode).toBe("ctrl")
        } finally {
            release()
            unsubscribe()
        }
    })
})
