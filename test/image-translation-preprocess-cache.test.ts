import { afterEach, describe, expect, it, vi } from "vitest"

import {
    decorateBlocksWithColors,
    type VisionPixelBuffer
} from "../src/image-translation/colors"
import {
    MAX_VISION_IMAGE_BYTES,
    prepareVisionImage,
    resizeDimensions,
    type VisionImageCodec
} from "../src/image-translation/preprocess"
import {
    configureImageTranslationCache,
    createImageTranslationCacheKey,
    getCachedImageTranslation,
    IMAGE_TRANSLATION_CACHE_SCHEMA_VERSION,
    IMAGE_TRANSLATION_CACHE_TTL_MS,
    setCachedImageTranslation,
    withImageTranslationDeduplication,
    type ImageTranslationCacheStorage
} from "../src/translation/PictureCache"

const encoder = new TextEncoder()

const makeBlob = (size: number, type = "image/png") =>
    new Blob([new Uint8Array(size)], { type })

const baseResult = (text = "translated") => ({
    sourceWidth: 100,
    sourceHeight: 50,
    modelId: "model-a",
    cacheHit: true,
    blocks: [
        {
            box: [0, 0, 1000, 1000] as [number, number, number, number],
            sourceText: "source",
            translatedText: text,
            writingMode: "horizontal" as const,
            backgroundColor: "rgba(1, 2, 3, 0.92)",
            textColor: "#ffffff"
        }
    ]
})

class MemoryStorage implements ImageTranslationCacheStorage {
    readonly values = new Map<string, unknown>()
    readonly getCalls: Array<string | string[] | null> = []
    readonly setCalls: Record<string, unknown>[] = []
    readonly removeCalls: Array<string | string[]> = []
    failNextSet = false

    async get(keys: string | string[] | null) {
        this.getCalls.push(keys)
        const values: Record<string, unknown> = {}
        const requested =
            keys === null
                ? [...this.values.keys()]
                : Array.isArray(keys)
                  ? keys
                  : [keys]
        for (const key of requested) {
            if (this.values.has(key)) values[key] = this.values.get(key)
        }
        return structuredClone(values)
    }

    async set(values: Record<string, unknown>) {
        this.setCalls.push(structuredClone(values))
        if (this.failNextSet) {
            this.failNextSet = false
            throw new Error("storage set failed")
        }
        Object.entries(structuredClone(values)).forEach(([key, value]) =>
            this.values.set(key, value)
        )
    }

    async remove(keys: string | string[]) {
        this.removeCalls.push(keys)
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            this.values.delete(key)
        }
    }

    put(key: string, value: unknown) {
        this.values.set(key, structuredClone(value))
    }
}

const metadataFrom = (storage: MemoryStorage) =>
    [...storage.values.entries()].find(([key]) =>
        key.endsWith("_metadata")
    )?.[1] as {
        totalSize: number
        entries: Record<string, { timestamp: number; size: number }>
    }

afterEach(() => {
    vi.unstubAllGlobals()
    configureImageTranslationCache()
})

const makeCodec = (
    width: number,
    height: number,
    options: { failDecode?: boolean; failEncode?: boolean } = {}
) => {
    let closes = 0
    const encodes: Array<{ width: number; height: number; quality: number }> =
        []
    const codec: VisionImageCodec = {
        async decode() {
            if (options.failDecode) throw new Error("decode failed")
            return {
                width,
                height,
                close: () => {
                    closes += 1
                }
            }
        },
        async encodeWebp(_bitmap, encodedWidth, encodedHeight, quality) {
            encodes.push({
                width: encodedWidth,
                height: encodedHeight,
                quality
            })
            if (options.failEncode) throw new Error("encode failed")
            return new Blob(["webp"], { type: "image/webp" })
        }
    }
    return {
        codec,
        encodes,
        get closes() {
            return closes
        }
    }
}

describe("image preprocessing", () => {
    it("rejects one byte over 10 MiB before decoding while accepting exactly 10 MiB", async () => {
        const accepted = makeCodec(200, 100)
        await expect(
            prepareVisionImage(
                makeBlob(MAX_VISION_IMAGE_BYTES),
                "zh-CN",
                accepted.codec
            )
        ).resolves.toMatchObject({ sourceWidth: 200, preparedWidth: 200 })
        expect(accepted.closes).toBe(1)

        const rejected = makeCodec(200, 100)
        await expect(
            prepareVisionImage(
                makeBlob(MAX_VISION_IMAGE_BYTES + 1),
                "zh-CN",
                rejected.codec
            )
        ).rejects.toMatchObject({ code: "UNSUPPORTED_IMAGE" })
        expect(rejected.closes).toBe(0)
    })

    it("keeps smaller dimensions and scales landscape and portrait down to a 2048px long edge", () => {
        expect(resizeDimensions(400, 200)).toEqual({ width: 400, height: 200 })
        expect(resizeDimensions(4096, 2048)).toEqual({
            width: 2048,
            height: 1024
        })
        expect(resizeDimensions(1000, 4000)).toEqual({
            width: 512,
            height: 2048
        })
    })

    it("reuses supported inputs and encodes unsupported or resized inputs as WebP at 0.92", async () => {
        const reuse = makeCodec(100, 50)
        const source = new Blob(["source"], { type: "image/png" })
        await expect(
            prepareVisionImage(source, "zh-CN", reuse.codec)
        ).resolves.toMatchObject({ mimeType: "image/png", preparedWidth: 100 })
        expect(reuse.encodes).toEqual([])

        const resize = makeCodec(4096, 2048)
        await prepareVisionImage(
            makeBlob(4, "image/png"),
            "zh-CN",
            resize.codec
        )
        expect(resize.encodes).toEqual([
            { width: 2048, height: 1024, quality: 0.92 }
        ])

        const convert = makeCodec(100, 50)
        await prepareVisionImage(
            makeBlob(4, "image/tiff"),
            "zh-CN",
            convert.codec
        )
        expect(convert.encodes).toEqual([
            { width: 100, height: 50, quality: 0.92 }
        ])
    })

    it("returns base64 and original-byte hash and always releases decoded resources", async () => {
        const success = makeCodec(2, 1)
        await expect(
            prepareVisionImage(
                new Blob(["abc"], { type: "image/png" }),
                "zh-CN",
                success.codec
            )
        ).resolves.toMatchObject({
            base64: "YWJj",
            originalHash:
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        })
        expect(success.closes).toBe(1)

        const failure = makeCodec(2, 1, { failEncode: true })
        await expect(
            prepareVisionImage(
                makeBlob(4, "image/tiff"),
                "zh-CN",
                failure.codec
            )
        ).rejects.toMatchObject({ code: "UNSUPPORTED_IMAGE" })
        expect(failure.closes).toBe(1)
    })
})

describe("image block colors", () => {
    it("maps normalized regions, limits sampling, and selects readable text with 92% alpha", () => {
        const reads: Array<[number, number, number, number, number]> = []
        const pixels: VisionPixelBuffer = {
            width: 100,
            height: 50,
            read(x, y, width, height, maxSamples) {
                reads.push([x, y, width, height, maxSamples])
                return new Uint8ClampedArray(
                    Array.from({ length: maxSamples }, () => [
                        8, 8, 8, 255
                    ]).flat()
                )
            }
        }
        const [dark] = decorateBlocksWithColors(
            [
                {
                    box: [0, 0, 1000, 1000],
                    sourceText: "a",
                    translatedText: "b",
                    writingMode: "vertical"
                }
            ],
            pixels
        )
        expect(reads).toEqual([[0, 0, 100, 50, 64]])
        expect(dark).toMatchObject({
            backgroundColor: "rgba(8, 8, 8, 0.92)",
            textColor: "#ffffff",
            writingMode: "vertical"
        })

        const [light] = decorateBlocksWithColors(
            [{ ...dark, box: [500, 500, 1000, 1000] }],
            {
                width: 2,
                height: 2,
                read: (_x, _y, _width, _height, maxSamples) => {
                    expect(maxSamples).toBe(64)
                    return new Uint8ClampedArray([250, 250, 250, 255])
                }
            }
        )
        expect(light).toMatchObject({ textColor: "#000000" })
    })

    it("uses a deterministic neutral fallback when pixels are unavailable", () => {
        const [block] = decorateBlocksWithColors(
            [
                {
                    box: [0, 0, 1000, 1000],
                    sourceText: "a",
                    translatedText: "b",
                    writingMode: "horizontal"
                }
            ],
            null
        )
        expect(block).toMatchObject({
            backgroundColor: "rgba(128, 128, 128, 0.92)",
            textColor: "#000000"
        })

        const [transparent] = decorateBlocksWithColors(
            [
                {
                    box: [0, 0, 1000, 1000],
                    sourceText: "a",
                    translatedText: "b",
                    writingMode: "horizontal"
                }
            ],
            {
                width: 1,
                height: 1,
                read: (_x, _y, _width, _height, maxSamples) => {
                    expect(maxSamples).toBe(64)
                    return new Uint8ClampedArray([1, 2, 3, 0])
                }
            }
        )
        expect(transparent).toMatchObject({
            backgroundColor: "rgba(128, 128, 128, 0.92)",
            textColor: "#000000"
        })
    })
})

describe("structured image translation cache", () => {
    it("isolates deterministic keys by hash, language, model, and schema version", () => {
        const base = {
            imageHash: "hash-a",
            targetLanguage: "zh-CN",
            modelId: "model-a"
        }
        const key = createImageTranslationCacheKey(base)
        expect(
            createImageTranslationCacheKey({ ...base, imageHash: "hash-b" })
        ).not.toBe(key)
        expect(
            createImageTranslationCacheKey({ ...base, targetLanguage: "ja" })
        ).not.toBe(key)
        expect(
            createImageTranslationCacheKey({ ...base, modelId: "model-b" })
        ).not.toBe(key)
        expect(
            createImageTranslationCacheKey({
                ...base,
                schemaVersion: IMAGE_TRANSLATION_CACHE_SCHEMA_VERSION + 1
            })
        ).not.toBe(key)
    })

    it("returns a defensive cache hit until the exact 24-hour expiry boundary and does not cache empty results", async () => {
        const storage = new MemoryStorage()
        let now = 10
        configureImageTranslationCache({ storage, now: () => now })
        const key = {
            imageHash: "hash",
            targetLanguage: "zh",
            modelId: "model-a"
        }
        const input = baseResult()
        await setCachedImageTranslation(key, input)
        input.cacheHit = false
        input.blocks[0].translatedText = "mutated input"
        const hit = await getCachedImageTranslation(key)
        expect(hit).toMatchObject({
            cacheHit: true,
            blocks: [{ translatedText: "translated" }]
        })
        hit!.blocks[0].translatedText = "mutated hit"
        hit!.blocks[0].box[0] = 999
        const secondHit = await getCachedImageTranslation(key)
        expect(secondHit).toMatchObject({
            cacheHit: true,
            blocks: [{ translatedText: "translated", box: [0, 0, 1000, 1000] }]
        })
        now += IMAGE_TRANSLATION_CACHE_TTL_MS
        await expect(getCachedImageTranslation(key)).resolves.toBeNull()
        await setCachedImageTranslation(key, { ...baseResult(), blocks: [] })
        await expect(getCachedImageTranslation(key)).resolves.toBeNull()
    })

    it("accounts for replacements and evicts oldest structured entries above 8 MiB", async () => {
        const storage = new MemoryStorage()
        let now = 0
        configureImageTranslationCache({ storage, now: () => now++ })
        const huge = "x".repeat(3 * 1024 * 1024)
        await setCachedImageTranslation(
            { imageHash: "old", targetLanguage: "zh", modelId: "model" },
            baseResult(huge)
        )
        await setCachedImageTranslation(
            { imageHash: "middle", targetLanguage: "zh", modelId: "model" },
            baseResult(huge)
        )
        await setCachedImageTranslation(
            { imageHash: "new", targetLanguage: "zh", modelId: "model" },
            baseResult(huge)
        )
        await expect(
            getCachedImageTranslation({
                imageHash: "old",
                targetLanguage: "zh",
                modelId: "model"
            })
        ).resolves.toBeNull()
        await expect(
            getCachedImageTranslation({
                imageHash: "new",
                targetLanguage: "zh",
                modelId: "model"
            })
        ).resolves.toMatchObject({ cacheHit: true })
        await expect(
            getCachedImageTranslation({
                imageHash: "middle",
                targetLanguage: "zh",
                modelId: "model"
            })
        ).resolves.toMatchObject({ cacheHit: true })
        await setCachedImageTranslation(
            { imageHash: "new", targetLanguage: "zh", modelId: "model" },
            baseResult("replacement")
        )
        const metadata = metadataFrom(storage)
        const retainedEntries = [...storage.values.entries()].filter(
            ([key]) => !key.endsWith("_metadata")
        )
        expect(Object.keys(metadata.entries)).toEqual(
            retainedEntries.map(([key]) => key).sort()
        )
        expect(metadata.totalSize).toBe(
            retainedEntries.reduce(
                (total, [, entry]) =>
                    total + encoder.encode(JSON.stringify(entry)).byteLength,
                0
            )
        )
    })

    it("does not leave an oversized new entry outside structured metadata", async () => {
        const storage = new MemoryStorage()
        configureImageTranslationCache({ storage, now: () => 1 })
        const key = {
            imageHash: "oversized",
            targetLanguage: "zh",
            modelId: "model"
        }
        await setCachedImageTranslation(
            key,
            baseResult("x".repeat(9 * 1024 * 1024))
        )

        await expect(getCachedImageTranslation(key)).resolves.toBeNull()
        expect(metadataFrom(storage)).toEqual({ totalSize: 0, entries: {} })
        expect(
            [...storage.values.keys()].filter(
                entryKey =>
                    entryKey.startsWith("img_translation_v") &&
                    !entryKey.endsWith("_metadata")
            )
        ).toHaveLength(0)
    })

    it("serializes different-key writes and commits each entry with rebuilt metadata", async () => {
        const storage = new MemoryStorage()
        configureImageTranslationCache({ storage, now: () => 1 })
        await Promise.all([
            setCachedImageTranslation(
                { imageHash: "one", targetLanguage: "zh", modelId: "model" },
                baseResult("one")
            ),
            setCachedImageTranslation(
                { imageHash: "two", targetLanguage: "zh", modelId: "model" },
                baseResult("two")
            )
        ])
        await expect(
            getCachedImageTranslation({
                imageHash: "one",
                targetLanguage: "zh",
                modelId: "model"
            })
        ).resolves.toMatchObject({ blocks: [{ translatedText: "one" }] })
        await expect(
            getCachedImageTranslation({
                imageHash: "two",
                targetLanguage: "zh",
                modelId: "model"
            })
        ).resolves.toMatchObject({ blocks: [{ translatedText: "two" }] })
        expect(Object.keys(metadataFrom(storage).entries)).toHaveLength(2)
        expect(
            storage.setCalls.every(values => Object.keys(values).length === 2)
        ).toBe(true)
    })

    it("recovers metadata after a combined set failure and after removal succeeds before a set failure", async () => {
        const storage = new MemoryStorage()
        let now = 0
        configureImageTranslationCache({ storage, now: () => now++ })
        storage.failNextSet = true
        await setCachedImageTranslation(
            { imageHash: "failed", targetLanguage: "zh", modelId: "model" },
            baseResult("failed")
        )
        await expect(
            getCachedImageTranslation({
                imageHash: "failed",
                targetLanguage: "zh",
                modelId: "model"
            })
        ).resolves.toBeNull()

        const large = "x".repeat(5 * 1024 * 1024)
        await setCachedImageTranslation(
            { imageHash: "old", targetLanguage: "zh", modelId: "model" },
            baseResult(large)
        )
        await setCachedImageTranslation(
            { imageHash: "middle", targetLanguage: "zh", modelId: "model" },
            baseResult(large)
        )
        storage.failNextSet = true
        await setCachedImageTranslation(
            { imageHash: "new", targetLanguage: "zh", modelId: "model" },
            baseResult("new")
        )
        expect(storage.removeCalls).not.toHaveLength(0)
        await setCachedImageTranslation(
            { imageHash: "new", targetLanguage: "zh", modelId: "model" },
            baseResult("new")
        )
        await expect(
            getCachedImageTranslation({
                imageHash: "middle",
                targetLanguage: "zh",
                modelId: "model"
            })
        ).resolves.toMatchObject({ cacheHit: true })
        await expect(
            getCachedImageTranslation({
                imageHash: "new",
                targetLanguage: "zh",
                modelId: "model"
            })
        ).resolves.toMatchObject({ cacheHit: true })
        const metadata = metadataFrom(storage)
        expect(metadata.totalSize).toBe(
            [...storage.values.entries()]
                .filter(([key]) => !key.endsWith("_metadata"))
                .reduce(
                    (total, [, entry]) =>
                        total +
                        encoder.encode(JSON.stringify(entry)).byteLength,
                    0
                )
        )
    })

    it("keeps legacy cache records opaque while using the default Chrome adapter shapes", async () => {
        const storage = new MemoryStorage()
        storage.put("img_cache_legacy", { translatedImageUrl: "legacy" })
        storage.put("img_cache_metadata", { totalSize: 99, entries: {} })
        vi.stubGlobal("chrome", { storage: { local: storage } })
        let now = 1
        configureImageTranslationCache({ now: () => now })
        const key = { imageHash: "new", targetLanguage: "zh", modelId: "model" }
        await setCachedImageTranslation(key, baseResult())
        await expect(getCachedImageTranslation(key)).resolves.toMatchObject({
            cacheHit: true
        })
        now += IMAGE_TRANSLATION_CACHE_TTL_MS
        await expect(getCachedImageTranslation(key)).resolves.toBeNull()
        expect(storage.values.get("img_cache_legacy")).toEqual({
            translatedImageUrl: "legacy"
        })
        expect(storage.values.get("img_cache_metadata")).toEqual({
            totalSize: 99,
            entries: {}
        })
        expect(storage.getCalls).toContain(null)
        expect(storage.getCalls.some(call => typeof call === "string")).toBe(
            true
        )
        expect(storage.setCalls.some(call => typeof call === "object")).toBe(
            true
        )
        expect(storage.removeCalls.some(call => typeof call === "string")).toBe(
            true
        )
    })

    it("deduplicates same-key work and clears rejected work for a later retry", async () => {
        let calls = 0
        let release!: () => void
        const pending = new Promise<string>(resolve => {
            release = () => resolve("done")
        })
        const first = withImageTranslationDeduplication("same", () => {
            calls += 1
            return pending
        })
        const second = withImageTranslationDeduplication("same", () => {
            calls += 1
            return Promise.resolve("wrong")
        })
        release()
        await expect(Promise.all([first, second])).resolves.toEqual([
            "done",
            "done"
        ])
        expect(calls).toBe(1)

        await expect(
            withImageTranslationDeduplication("reject", async () => {
                throw new Error("no")
            })
        ).rejects.toThrow("no")
        await expect(
            withImageTranslationDeduplication("reject", async () => "retry")
        ).resolves.toBe("retry")
    })
})
