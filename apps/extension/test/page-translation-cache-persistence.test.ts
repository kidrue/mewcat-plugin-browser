import { IDBFactory, IDBKeyRange, IDBObjectStore } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { L2PersistentCache } from "../src/translation/cache/L2PersistentCache"
import { TieredTranslationCache } from "../src/translation/cache/TieredTranslationCache"

const caches: TieredTranslationCache[] = []
const params = {
    text: "A short paragraph",
    sourceLang: "en",
    targetLang: "zh-CN",
    modelId: "test-model",
    aiRole: "DEFAULT"
}
function createCache() {
    const cache = new TieredTranslationCache({
        cleanupConfig: { enabled: false }
    })
    caches.push(cache)
    return cache
}
beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory())
    vi.stubGlobal("IDBKeyRange", IDBKeyRange)
})
afterEach(() => {
    caches.splice(0).forEach(cache => cache.destroy())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("page translation persistent cache", () => {
    it("does not mix persistent translations for long HTTP texts with the same legacy hash", async () => {
        vi.stubGlobal("crypto", {})
        const prefix =
            "This is a long ordinary English paragraph for testing persistent translations on an insecure HTTP page. Reference word: "
        const firstEntry = { ...params, text: prefix + "klmzansjkpud" }
        const secondEntry = { ...params, text: prefix + "snsfwlonorgl" }
        const cache = new L2PersistentCache()
        try {
            await cache.set(firstEntry, "第一段译文")
            await cache.set(secondEntry, "第二段译文")
            cache.close()
            const reloaded = new L2PersistentCache()
            try {
                expect(await reloaded.get(firstEntry)).toBe("第一段译文")
                expect(await reloaded.get(secondEntry)).toBe("第二段译文")
            } finally {
                reloaded.close()
            }
        } finally {
            cache.close()
        }
    })

    it("reuses long-paragraph caches when Web Crypto is unavailable on an HTTP page", async () => {
        vi.stubGlobal("crypto", {})
        vi.spyOn(console, "error").mockImplementation(() => {})
        const entry = {
            ...params,
            text: "An English paragraph on an ordinary HTTP page. ".repeat(8)
        }
        const first = createCache()
        await first.init()
        await first.set(entry, "HTTP 页面译文")
        first.destroy()
        const reloaded = createCache()
        await reloaded.init()
        expect(await reloaded.get(entry)).toBe("HTTP 页面译文")
    })

    it("does not report a successful persistent write when its transaction aborts", async () => {
        const cache = new L2PersistentCache()
        await cache.init()
        const put = IDBObjectStore.prototype.put
        vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
            this: IDBObjectStore,
            ...args
        ) {
            const request = put.apply(this, args)
            request.addEventListener(
                "success",
                () => this.transaction.abort(),
                { once: true }
            )
            return request
        })
        try {
            await expect(
                cache.set(params, "未提交的译文")
            ).rejects.toBeDefined()
        } finally {
            cache.close()
        }
    })

    it.each([
        { name: "short paragraph", text: params.text },
        {
            name: "long paragraph",
            text: "A long paragraph that should remain cached across page reloads. ".repeat(
                10
            )
        }
    ])(
        "preserves translations when the page cache closes immediately after writing ($name)",
        async ({ text }) => {
            vi.spyOn(console, "error").mockImplementation(() => {})
            const first = createCache()
            await first.init()
            await first.set({ ...params, text }, "应当保留的译文")
            first.destroy()
            const reloaded = createCache()
            await reloaded.init()
            expect(await reloaded.get({ ...params, text })).toBe(
                "应当保留的译文"
            )
        }
    )
})
