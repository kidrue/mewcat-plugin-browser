import { storage } from "#imports"

const toLocalStorageKey = (key: string): `local:${string}` => `local:${key}`

// Chrome Storage 适配器 for Jotai
export const chromeStorageAdapter = {
    async getItem<T>(key: string, initialValue: T): Promise<T> {
        const value = await storage.getItem<T>(toLocalStorageKey(key))
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
        await storage.setItem(toLocalStorageKey(key), value)
    },
    removeItem: async (key: string): Promise<void> => {
        await storage.removeItem(toLocalStorageKey(key))
    },
    subscribe<T>(key: string, callback: (value: T) => void, initialValue: T) {
        return storage.watch<T>(toLocalStorageKey(key), newValue => {
            callback((newValue ?? initialValue) as T)
        })
    }
}
