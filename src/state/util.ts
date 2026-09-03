import { storage } from "#imports"

import { STORAGE_NAMES, toWxtLocalStorageKey, toWxtSyncStorageKey } from "@/constants/storage"

const PERSISTED_ATOM_KEYS: Readonly<Record<string, string>> = {
    "extension-config": STORAGE_NAMES.extensionConfig,
    accessToken: STORAGE_NAMES.accessToken,
    refreshToken: STORAGE_NAMES.refreshToken
}

const toLocalStorageKey = (key: string): `local:${string}` =>
    toWxtLocalStorageKey(PERSISTED_ATOM_KEYS[key] ?? key)

const toSyncStorageKey = (key: string): `sync:${string}` =>
    toWxtSyncStorageKey(PERSISTED_ATOM_KEYS[key] ?? key)


// Chrome Storage 适配器 for Jotai
export const chromeStorageAdapter = {
    async getItem<T>(key: string, initialValue: T): Promise<T> {
        const value = await storage.getItem<T>(toSyncStorageKey(key))
        if (value == null) {
            return initialValue
        }
        if (typeof value === "object" && Object.keys(value).length === 0) {
            return initialValue
        }
        if (value === "") {
            return initialValue
        }
        return value as T
    },
    async setItem<T>(key: string, value: T): Promise<void> {
        await storage.setItem(toSyncStorageKey(key), value)
    },
    removeItem: async (key: string): Promise<void> => {
        await storage.removeItem(toSyncStorageKey(key))
    },
    subscribe<T>(key: string, callback: (value: T) => void, initialValue: T) {
        return storage.watch<T>(toSyncStorageKey(key), newValue => {
            callback((newValue ?? initialValue) as T)
        })
    }
}
