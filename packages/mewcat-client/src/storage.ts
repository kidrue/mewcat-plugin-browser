import type { ClientState } from "./client.js"

// IndexedDB 支持结构化克隆 CryptoKey；chrome.storage 和 JSON 不支持。
async function database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("mewcat-translation", 1)
        request.onupgradeneeded = () => {
            request.result.createObjectStore("identities")
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}
export async function loadClientState(
    serviceOrigin: string
): Promise<ClientState | undefined> {
    const db = await database()
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction("identities", "readonly")
            const request = tx.objectStore("identities").get(serviceOrigin)
            tx.oncomplete = () =>
                resolve(request.result as ClientState | undefined)
            tx.onerror = () => reject(tx.error)
            tx.onabort = () => reject(tx.error)
        })
    } finally {
        db.close()
    }
}
export async function saveClientState(
    serviceOrigin: string,
    state: ClientState
): Promise<void> {
    const db = await database()
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction("identities", "readwrite")
            tx.objectStore("identities").put(state, serviceOrigin)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
            tx.onabort = () => reject(tx.error)
        })
    } finally {
        db.close()
    }
}
