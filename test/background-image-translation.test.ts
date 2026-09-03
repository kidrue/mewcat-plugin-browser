import { describe, expect, it, vi } from "vitest"

import { registerExtensionMessages } from "../src/background"
import {
    createBrowserConfigLoader,
    createBrowserVisionPixelBuffer,
    createStructuredImageTranslationHandler,
    sendStrictBackup,
    type StructuredImageTranslationDependencies
} from "../src/background/messages/structured-image-translation"
import { captureImageForTranslation } from "../src/background/messages/translate-image"
import { VisionProviderError } from "../src/image-translation/errors"
import type {
    PreparedVisionImage,
    VisionTranslationResult
} from "../src/image-translation/types"
import type {
    ImageTranslationResult,
    TranslateImageRequest
} from "../src/messaging/protocol"

const request: TranslateImageRequest = {
    imageUrl: "https://images.example.test/page.png",
    targetLanguage: "zh-CN",
    modelId: "vision-model",
    requestId: "request-123"
}

const model = {
    id: "vision-model",
    type: "OPENAI" as const,
    enabled: true,
    name: "Vision model",
    capabilities: { vision: true },
    params: {
        modelName: "gpt-5-mini",
        apiKey: "top-secret-key",
        isOfficial: true
    }
}

const prepared: PreparedVisionImage = {
    mimeType: "image/png",
    base64: "image-base64-must-not-leak",
    targetLanguage: "zh-CN",
    sourceWidth: 640,
    sourceHeight: 480,
    preparedWidth: 640,
    preparedHeight: 480,
    originalHash: "source-hash"
}

const translated: VisionTranslationResult = {
    sourceWidth: 640,
    sourceHeight: 480,
    blocks: [
        {
            box: [10, 20, 100, 300],
            sourceText: "raw OCR source text",
            translatedText: "翻译文本",
            writingMode: "horizontal"
        }
    ]
}

const decoratedBlocks: ImageTranslationResult["blocks"] = [
    {
        ...translated.blocks[0],
        backgroundColor: "rgba(10, 20, 30, 0.92)",
        textColor: "#ffffff"
    }
]

function createDeps(
    overrides: Partial<StructuredImageTranslationDependencies> = {}
): StructuredImageTranslationDependencies {
    return {
        loadConfig: vi.fn(async () => ({ aiModelList: [model] })),
        capture: vi.fn(async () => ({
            blob: new Blob(["source-image"], { type: "image/png" }),
            capturePath: "direct-fetch"
        })),
        prepare: vi.fn(async () => prepared),
        getCache: vi.fn(async () => null),
        setCache: vi.fn(async () => {}),
        deduplicate: (_key, work) => work(),
        translate: vi.fn(async () => translated),
        createPixelBuffer: vi.fn(async () => null),
        decorate: vi.fn(() => decoratedBlocks),
        isVisionCapable: candidate => candidate?.capabilities?.vision !== false,
        sendBackup: vi.fn(async () => {}),
        ...overrides
    }
}

describe("structured background image translation", () => {
    it("rejects blank target language and missing capture targets before config", async () => {
        const deps = createDeps()
        const handler = createStructuredImageTranslationHandler(deps)

        await expect(
            handler({ ...request, targetLanguage: "  " }, {})
        ).resolves.toMatchObject({
            success: false,
            errorCode: "INVALID_REQUEST"
        })
        await expect(
            handler({ targetLanguage: "zh-CN", modelId: model.id }, {})
        ).resolves.toMatchObject({
            success: false,
            errorCode: "INVALID_REQUEST"
        })
        expect(deps.loadConfig).not.toHaveBeenCalled()
    })

    it("maps a real missing capture target to UNSUPPORTED_IMAGE", async () => {
        await expect(
            captureImageForTranslation({ targetLanguage: "zh-CN" }, {})
        ).rejects.toMatchObject({ code: "UNSUPPORTED_IMAGE" })
    })

    it("maps a real capture download abort to REQUEST_TIMEOUT", async () => {
        vi.useFakeTimers()
        vi.stubGlobal(
            "fetch",
            (_input: RequestInfo | URL, init?: RequestInit) =>
                new Promise((_resolve, reject) => {
                    // The capture timeout owns this signal and rejects fetch.
                    init?.signal?.addEventListener("abort", () =>
                        reject(new DOMException("Timed out", "AbortError"))
                    )
                })
        )
        const pending = captureImageForTranslation(
            {
                imageUrl: "https://images.example.test/slow.png",
                targetLanguage: "zh-CN"
            },
            {}
        )
        const expectation = expect(pending).rejects.toMatchObject({
            code: "REQUEST_TIMEOUT"
        })
        await vi.advanceTimersByTimeAsync(15_000)
        await expectation
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it("rejects malformed requests before reading config or capturing", async () => {
        const deps = createDeps()
        const response = await createStructuredImageTranslationHandler(deps)(
            { targetLanguage: "zh-CN" },
            {}
        )

        expect(response).toMatchObject({
            success: false,
            errorCode: "INVALID_REQUEST"
        })
        expect(deps.loadConfig).not.toHaveBeenCalled()
        expect(deps.capture).not.toHaveBeenCalled()
    })

    it.each([
        ["missing", [], "MODEL_NOT_FOUND"],
        [
            "not vision",
            [{ ...model, capabilities: { vision: false } }],
            "MODEL_NOT_VISION_CAPABLE"
        ],
        ["disabled", [{ ...model, enabled: false }], "MODEL_UNAVAILABLE"],
        [
            "blank key",
            [{ ...model, params: { ...model.params, apiKey: "  " } }],
            "MODEL_UNAVAILABLE"
        ]
    ])("maps a %s model to %s without capture", async (_name, models, code) => {
        const deps = createDeps({
            loadConfig: vi.fn(async () => ({ aiModelList: models }))
        })
        const response = await createStructuredImageTranslationHandler(deps)(
            request,
            {}
        )

        expect(response).toMatchObject({ success: false, errorCode: code })
        expect(deps.capture).not.toHaveBeenCalled()
    })

    it("returns a cache hit without provider or color work", async () => {
        const cached: ImageTranslationResult = {
            sourceWidth: 640,
            sourceHeight: 480,
            modelId: model.id,
            cacheHit: true,
            blocks: decoratedBlocks
        }
        const deps = createDeps({ getCache: vi.fn(async () => cached) })
        const response = await createStructuredImageTranslationHandler(deps)(
            request,
            {}
        )

        expect(response).toEqual({ success: true, result: cached })
        expect(deps.translate).not.toHaveBeenCalled()
        expect(deps.createPixelBuffer).not.toHaveBeenCalled()
        expect(deps.decorate).not.toHaveBeenCalled()
        expect(deps.setCache).not.toHaveBeenCalled()
    })

    it("captures, rechecks cache inside deduplication, translates, colors and caches on a miss", async () => {
        const getCache = vi.fn(async () => null)
        const deps = createDeps({ getCache })
        const response = await createStructuredImageTranslationHandler(deps)(
            request,
            {}
        )

        expect(response).toEqual({
            success: true,
            result: {
                sourceWidth: 640,
                sourceHeight: 480,
                modelId: "vision-model",
                cacheHit: false,
                blocks: decoratedBlocks
            }
        })
        expect(deps.capture).toHaveBeenCalledTimes(1)
        expect(deps.prepare).toHaveBeenCalledTimes(1)
        expect(getCache).toHaveBeenCalledTimes(2)
        expect(deps.translate).toHaveBeenCalledWith(prepared, model)
        expect(deps.decorate).toHaveBeenCalledWith(translated.blocks, null)
        expect(deps.setCache).toHaveBeenCalledTimes(1)
    })

    it("deduplicates concurrent cache misses so provider work happens once", async () => {
        let resolveProvider:
            | ((value: VisionTranslationResult) => void)
            | undefined
        const provider = vi.fn(
            () =>
                new Promise<VisionTranslationResult>(resolve => {
                    resolveProvider = resolve
                })
        )
        const pending = new Map<string, Promise<unknown>>()
        const deps = createDeps({
            translate: provider,
            deduplicate: (key, work) => {
                const existing = pending.get(key)
                if (existing) return existing
                const running = work().finally(() => pending.delete(key))
                pending.set(key, running)
                return running
            }
        })
        const handler = createStructuredImageTranslationHandler(deps)
        const first = handler(request, {})
        const second = handler({ ...request, requestId: "request-456" }, {})
        await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1))
        resolveProvider?.(translated)

        await expect(Promise.all([first, second])).resolves.toEqual([
            expect.objectContaining({ success: true }),
            expect.objectContaining({ success: true })
        ])
    })

    it("returns NO_TEXT and does not cache an empty valid provider result", async () => {
        const deps = createDeps({
            translate: vi.fn(async () => ({ ...translated, blocks: [] }))
        })
        const response = await createStructuredImageTranslationHandler(deps)(
            request,
            {}
        )

        expect(response).toMatchObject({ success: false, errorCode: "NO_TEXT" })
        expect(deps.setCache).not.toHaveBeenCalled()
        expect(deps.decorate).not.toHaveBeenCalled()
    })

    it.each([
        [
            new VisionProviderError("AUTHENTICATION_FAILED", "safe", 401),
            "AUTHENTICATION_FAILED"
        ],
        [new VisionProviderError("RATE_LIMITED", "safe", 429), "RATE_LIMITED"],
        [new VisionProviderError("REQUEST_TIMEOUT", "safe"), "REQUEST_TIMEOUT"],
        [
            new VisionProviderError("MALFORMED_PROVIDER_RESPONSE", "safe"),
            "MALFORMED_PROVIDER_RESPONSE"
        ],
        [
            new VisionProviderError("PROVIDER_FAILURE", "safe"),
            "PROVIDER_FAILURE"
        ],
        [
            new VisionProviderError("UNSUPPORTED_IMAGE", "safe"),
            "UNSUPPORTED_IMAGE"
        ],
        [
            new Error("provider response containing top-secret-key"),
            "INTERNAL_ERROR"
        ]
    ])("maps failures to safe stable error codes", async (failure, code) => {
        const deps = createDeps({
            translate: vi.fn(async () => Promise.reject(failure))
        })
        const response = await createStructuredImageTranslationHandler(deps)(
            request,
            {}
        )

        expect(response).toMatchObject({ success: false, errorCode: code })
        expect(JSON.stringify(response)).not.toContain("top-secret-key")
    })

    it("uses a neutral color fallback when color decoding fails", async () => {
        const fallback = [
            {
                ...decoratedBlocks[0],
                backgroundColor: "rgba(128, 128, 128, 0.92)"
            }
        ]
        const deps = createDeps({
            createPixelBuffer: vi.fn(async () => {
                throw new Error("decode failure")
            }),
            decorate: vi.fn(() => fallback)
        })
        const response = await createStructuredImageTranslationHandler(deps)(
            request,
            {}
        )

        expect(response).toMatchObject({
            success: true,
            result: { blocks: fallback }
        })
        expect(deps.decorate).toHaveBeenCalledWith(translated.blocks, null)
    })

    it("releases the decoded color buffer after decorating blocks", async () => {
        const close = vi.fn()
        const pixels = {
            width: 640,
            height: 480,
            read: () => new Uint8ClampedArray([10, 20, 30, 255]),
            close
        }
        const deps = createDeps({
            createPixelBuffer: vi.fn(async () => pixels)
        })

        await createStructuredImageTranslationHandler(deps)(request, {})

        expect(deps.decorate).toHaveBeenCalledWith(translated.blocks, pixels)
        expect(close).toHaveBeenCalledTimes(1)
    })

    it("falls back to neutral colors and closes the buffer when decoration throws", async () => {
        const close = vi.fn()
        const fallback = [
            {
                ...decoratedBlocks[0],
                backgroundColor: "rgba(128, 128, 128, 0.92)"
            }
        ]
        const decorate = vi
            .fn()
            .mockImplementationOnce(() => {
                throw new Error("read failure")
            })
            .mockReturnValueOnce(fallback)
        const deps = createDeps({
            createPixelBuffer: vi.fn(async () => ({
                width: 640,
                height: 480,
                read: () => new Uint8ClampedArray(),
                close
            })),
            decorate
        })

        await expect(
            createStructuredImageTranslationHandler(deps)(request, {})
        ).resolves.toMatchObject({
            success: true,
            result: { blocks: fallback }
        })
        expect(close).toHaveBeenCalledTimes(1)
        expect(decorate).toHaveBeenLastCalledWith(translated.blocks, null)
    })

    it.each([
        [1, 10_000],
        [10_000, 1]
    ])(
        "bounds production pixel canvas samples for a %i by %i narrow region",
        async (width, height) => {
            const close = vi.fn()
            const canvases: Array<{ width: number; height: number }> = []
            vi.stubGlobal("createImageBitmap", async () => ({
                width: 10_000,
                height: 10_000,
                close
            }))
            vi.stubGlobal(
                "OffscreenCanvas",
                class {
                    constructor(
                        public width: number,
                        public height: number
                    ) {
                        canvases.push(this)
                    }
                    getContext() {
                        return {
                            drawImage: vi.fn(),
                            getImageData: () => ({
                                data: new Uint8ClampedArray(
                                    this.width * this.height * 4
                                )
                            })
                        }
                    }
                }
            )
            const pixels = await createBrowserVisionPixelBuffer(
                new Blob(["image"], { type: "image/png" })
            )

            pixels?.read(0, 0, width, height, 64)
            expect(canvases).toHaveLength(1)
            expect(canvases[0].width * canvases[0].height).toBeLessThanOrEqual(
                64
            )
            pixels?.close?.()
            expect(close).toHaveBeenCalledTimes(1)
            vi.unstubAllGlobals()
        }
    )

    it("uses the WXT local config key through the production loader boundary", async () => {
        const getItem = vi.fn(async () => ({ aiModelList: [model] }))

        await expect(createBrowserConfigLoader(getItem)()).resolves.toEqual({
            aiModelList: [model]
        })
        expect(getItem).toHaveBeenCalledWith("local:extension-config")
    })

    it("filters corrupted models at the production loader boundary", async () => {
        const getItem = vi.fn(async () => ({
            aiModelList: [model, { id: "broken-model" }]
        }))

        await expect(createBrowserConfigLoader(getItem)()).resolves.toEqual({
            aiModelList: [model]
        })
    })

    it("writes response-identical strict backups only for request-scoped calls", async () => {
        const set = vi.fn(async () => {})
        const sendMessage = vi.fn(async () => {})
        vi.stubGlobal("chrome", {
            storage: { local: { set } },
            tabs: { sendMessage }
        })
        const success = {
            success: true as const,
            result: {
                sourceWidth: 1,
                sourceHeight: 1,
                modelId: model.id,
                cacheHit: false,
                blocks: []
            }
        }
        const failure = {
            success: false as const,
            errorCode: "NO_TEXT" as const,
            message: "图片中未识别到可翻译文本。"
        }

        await sendStrictBackup({ tab: { id: 9 } }, request, success)
        await sendStrictBackup(
            { tab: { id: 9 } },
            { ...request, requestId: "request-failure" },
            failure
        )
        await sendStrictBackup(
            { tab: { id: 9 } },
            { ...request, requestId: undefined },
            failure
        )

        expect(set).toHaveBeenCalledWith({
            "__tr_result_request-123": success
        })
        expect(set).toHaveBeenCalledWith({
            "__tr_result_request-failure": failure
        })
        expect(sendMessage).toHaveBeenCalledWith(9, {
            type: "__translate_image_result__",
            requestId: "request-123",
            response: success
        })
        expect(sendMessage).toHaveBeenCalledWith(9, {
            type: "__translate_image_result__",
            requestId: "request-failure",
            response: failure
        })
        expect(set).toHaveBeenCalledTimes(2)
        expect(sendMessage).toHaveBeenCalledTimes(2)
        vi.unstubAllGlobals()
    })

    it("registers strict and legacy handlers on separate production message names", async () => {
        type RegisteredHandler = (message: {
            data: unknown
            sender: chrome.runtime.MessageSender
        }) => unknown
        const registrations: Array<[string, RegisteredHandler]> = []
        registerExtensionMessages(((
            name: string,
            handler: RegisteredHandler
        ) => {
            registrations.push([name, handler])
        }) as never)
        const strict = registrations.find(
            ([name]) => name === "translate-image"
        )?.[1]
        const legacy = registrations.find(
            ([name]) => name === "translate-image-legacy"
        )?.[1]

        await expect(strict?.({ data: {}, sender: {} })).resolves.toMatchObject(
            { errorCode: "INVALID_REQUEST" }
        )
        await expect(
            legacy?.({ data: { targetLanguage: "zh-CN" }, sender: {} })
        ).resolves.toMatchObject({ success: false, error: expect.any(String) })
    })

    it("sends a response-identical sanitized strict backup scoped to requestId", async () => {
        const sendBackup = vi.fn(async () => {})
        const deps = createDeps({ sendBackup })
        const response = await createStructuredImageTranslationHandler(deps)(
            request,
            { tab: { id: 7 } }
        )

        expect(sendBackup).toHaveBeenCalledWith(
            { tab: { id: 7 } },
            request,
            response
        )
        const backup = JSON.stringify(sendBackup.mock.calls[0][2])
        expect(backup).not.toContain("top-secret-key")
        expect(backup).not.toContain("image-base64-must-not-leak")
    })
})
