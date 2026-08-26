import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { translateStructuredImageViaBackground } from "@/services/imageTranslation"

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }))

vi.mock("@/messaging", () => ({ sendMessage }))

const strictResult = {
    sourceWidth: 100,
    sourceHeight: 100,
    modelId: "vision",
    cacheHit: false,
    blocks: [
        {
            box: [0, 0, 1000, 1000],
            sourceText: "source",
            translatedText: "译文",
            writingMode: "horizontal",
            backgroundColor: "#ffffff",
            textColor: "#000000"
        }
    ]
}

const emptyStrictResult = { ...strictResult, blocks: [] }

type RuntimeListener = (message: Record<string, unknown>) => void
type StorageListener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
) => void

let activeRuntimeListeners: Set<RuntimeListener>
let activeStorageListeners: Set<StorageListener>
let runtimeAddListener: ReturnType<typeof vi.fn>
let runtimeRemoveListener: ReturnType<typeof vi.fn>
let storageAddListener: ReturnType<typeof vi.fn>
let storageRemoveListener: ReturnType<typeof vi.fn>
let storageRemove: ReturnType<typeof vi.fn>

const emitRuntime = (message: Record<string, unknown>) => {
    for (const listener of [...activeRuntimeListeners]) {
        listener(message)
    }
}

const emitStorage = (
    changes: Record<string, chrome.storage.StorageChange>,
    area = "local"
) => {
    for (const listener of [...activeStorageListeners]) {
        listener(changes, area)
    }
}

const getRequest = (callIndex = 0) => {
    expect(sendMessage.mock.calls[callIndex]?.[0]).toBe("translate-image")
    return sendMessage.mock.calls[callIndex]?.[1] as {
        requestId: string
        modelId: string
    }
}

const expectRegistered = (count = 1) => {
    expect(runtimeAddListener).toHaveBeenCalledTimes(count)
    expect(storageAddListener).toHaveBeenCalledTimes(count)
    expect(activeRuntimeListeners).toHaveLength(count)
    expect(activeStorageListeners).toHaveLength(count)
}

const expectCleanedUp = (requestId: string) => {
    expect(activeRuntimeListeners).toHaveLength(0)
    expect(activeStorageListeners).toHaveLength(0)
    expect(runtimeRemoveListener).toHaveBeenCalledTimes(1)
    expect(runtimeRemoveListener.mock.calls[0]?.[0]).toBe(
        runtimeAddListener.mock.calls[0]?.[0]
    )
    expect(storageRemoveListener).toHaveBeenCalledTimes(1)
    expect(storageRemoveListener.mock.calls[0]?.[0]).toBe(
        storageAddListener.mock.calls[0]?.[0]
    )
    expect(storageRemove).toHaveBeenCalledTimes(1)
    expect(storageRemove).toHaveBeenCalledWith(`__tr_result_${requestId}`)
}

const deferred = <T>() => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

beforeEach(() => {
    activeRuntimeListeners = new Set()
    activeStorageListeners = new Set()
    runtimeAddListener = vi.fn((listener: RuntimeListener) => {
        activeRuntimeListeners.add(listener)
    })
    runtimeRemoveListener = vi.fn((listener: RuntimeListener) => {
        activeRuntimeListeners.delete(listener)
    })
    storageAddListener = vi.fn((listener: StorageListener) => {
        activeStorageListeners.add(listener)
    })
    storageRemoveListener = vi.fn((listener: StorageListener) => {
        activeStorageListeners.delete(listener)
    })
    storageRemove = vi.fn().mockResolvedValue(undefined)
    sendMessage.mockReset()
    vi.stubGlobal("chrome", {
        runtime: {
            onMessage: {
                addListener: runtimeAddListener,
                removeListener: runtimeRemoveListener
            }
        },
        storage: {
            onChanged: {
                addListener: storageAddListener,
                removeListener: storageRemoveListener
            },
            local: { remove: storageRemove }
        }
    })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe("strict image translation content service", () => {
    it("requires a nonblank vision model before registering channels or sending a request", async () => {
        await expect(
            translateStructuredImageViaBackground({
                imageUrl: "https://example.test/image.png",
                targetLanguage: "zh-CN",
                modelId: "  "
            })
        ).rejects.toEqual(new Error("请选择视觉模型后再翻译图片"))
        expect(sendMessage).not.toHaveBeenCalled()
        expect(runtimeAddListener).not.toHaveBeenCalled()
        expect(storageAddListener).not.toHaveBeenCalled()
        expect(storageRemove).not.toHaveBeenCalled()
    })

    it("resolves an exact valid primary result and removes request resources once", async () => {
        vi.useFakeTimers()
        sendMessage.mockResolvedValue({ success: true, result: strictResult })

        const pending = translateStructuredImageViaBackground({
            imageUrl: "https://example.test/image.png",
            targetLanguage: "zh-CN",
            modelId: " vision "
        })
        const request = getRequest()
        expect(request.modelId).toBe("vision")
        expectRegistered()

        await expect(pending).resolves.toEqual(strictResult)
        expectCleanedUp(request.requestId)
        expect(vi.getTimerCount()).toBe(0)
    })

    it("ignores a malformed primary success and accepts a later valid tab success", async () => {
        sendMessage.mockResolvedValue({
            success: true,
            result: { ...strictResult, sourceWidth: Number.NaN }
        })
        const pending = translateStructuredImageViaBackground({
            imageUrl: "https://example.test/image.png",
            targetLanguage: "zh-CN",
            modelId: "vision"
        })
        const request = getRequest()

        await Promise.resolve()
        expectRegistered()
        emitRuntime({
            type: "__translate_image_result__",
            requestId: request.requestId,
            response: { success: true, result: strictResult }
        })

        await expect(pending).resolves.toEqual(strictResult)
        expectCleanedUp(request.requestId)
    })

    it("ignores malformed tab and storage successes until another channel is valid", async () => {
        const primary = deferred<unknown>()
        sendMessage.mockReturnValue(primary.promise)
        const pending = translateStructuredImageViaBackground({
            imageUrl: "https://example.test/image.png",
            targetLanguage: "zh-CN",
            modelId: "vision"
        })
        const request = getRequest()
        const storageKey = `__tr_result_${request.requestId}`

        emitRuntime({
            type: "__translate_image_result__",
            requestId: request.requestId,
            response: {
                success: true,
                result: {
                    ...strictResult,
                    blocks: [
                        {
                            box: [0, 0, 100, 100],
                            sourceText: "source",
                            translatedText: " ",
                            writingMode: "horizontal",
                            backgroundColor: "#fff",
                            textColor: "#000"
                        }
                    ]
                }
            }
        })
        emitStorage({
            [storageKey]: {
                newValue: {
                    success: true,
                    result: { ...strictResult, sourceHeight: 0 }
                }
            }
        })
        expectRegistered()

        emitStorage({
            [storageKey]: {
                newValue: { success: true, result: strictResult }
            }
        })

        await expect(pending).resolves.toEqual(strictResult)
        expectCleanedUp(request.requestId)
    })

    it.each(["primary", "tab", "storage"] as const)(
        "maps an otherwise valid empty %s success to stable NO_TEXT and cleans up",
        async channel => {
            vi.useFakeTimers()
            const primary = deferred<unknown>()
            sendMessage.mockReturnValue(primary.promise)
            const pending = translateStructuredImageViaBackground({
                imageUrl: "https://example.test/image.png",
                targetLanguage: "zh-CN",
                modelId: "vision"
            })
            const request = getRequest()
            const emptyResponse = {
                success: true,
                result: emptyStrictResult
            }

            if (channel === "primary") {
                primary.resolve(emptyResponse)
            } else if (channel === "tab") {
                emitRuntime({
                    type: "__translate_image_result__",
                    requestId: request.requestId,
                    response: emptyResponse
                })
            } else {
                emitStorage({
                    [`__tr_result_${request.requestId}`]: {
                        newValue: emptyResponse
                    }
                })
            }

            await expect(pending).rejects.toEqual(
                new Error("图片中未识别到可翻译文字")
            )
            expectCleanedUp(request.requestId)
            expect(vi.getTimerCount()).toBe(0)
        }
    )

    it.each(["primary", "tab", "storage"] as const)(
        "ignores an empty %s success with malformed non-block fields",
        async channel => {
            const primary = deferred<unknown>()
            sendMessage.mockReturnValue(primary.promise)
            const pending = translateStructuredImageViaBackground({
                imageUrl: "https://example.test/image.png",
                targetLanguage: "zh-CN",
                modelId: "vision"
            })
            const request = getRequest()
            const malformedResponse = {
                success: true,
                result: { ...emptyStrictResult, sourceWidth: Number.NaN }
            }

            if (channel === "primary") {
                primary.resolve(malformedResponse)
                await Promise.resolve()
            } else if (channel === "tab") {
                emitRuntime({
                    type: "__translate_image_result__",
                    requestId: request.requestId,
                    response: malformedResponse
                })
            } else {
                emitStorage({
                    [`__tr_result_${request.requestId}`]: {
                        newValue: malformedResponse
                    }
                })
            }

            expectRegistered()
            expect(storageRemove).not.toHaveBeenCalled()
            emitRuntime({
                type: "__translate_image_result__",
                requestId: request.requestId,
                response: { success: true, result: strictResult }
            })
            await expect(pending).resolves.toEqual(strictResult)
            expectCleanedUp(request.requestId)
        }
    )

    it.each([
        ["AUTHENTICATION_FAILED", "视觉模型认证失败"],
        ["RATE_LIMITED", "请求过于频繁，请稍后重试"],
        ["REQUEST_TIMEOUT", "翻译超时，请重试"],
        ["MALFORMED_PROVIDER_RESPONSE", "视觉模型返回格式无效"]
    ] as const)(
        "maps %s to the stable public error and cleans up",
        async (errorCode, expectedMessage) => {
            vi.useFakeTimers()
            sendMessage.mockResolvedValue({
                success: false,
                errorCode,
                message: "provider-private-body"
            })
            const pending = translateStructuredImageViaBackground({
                imageUrl: "https://example.test/image.png",
                targetLanguage: "zh-CN",
                modelId: "vision"
            })
            const request = getRequest()

            await expect(pending).rejects.toEqual(new Error(expectedMessage))
            expectCleanedUp(request.requestId)
            expect(vi.getTimerCount()).toBe(0)
        }
    )

    it("times out at 90 seconds and removes listeners, timer state, and only its storage key", async () => {
        vi.useFakeTimers()
        sendMessage.mockReturnValue(new Promise(() => {}))
        const pending = translateStructuredImageViaBackground({
            imageUrl: "https://example.test/image.png",
            targetLanguage: "zh-CN",
            modelId: "vision"
        })
        const request = getRequest()
        expectRegistered()

        const rejection = expect(pending).rejects.toEqual(
            new Error("翻译超时，请重试")
        )
        await vi.advanceTimersByTimeAsync(89_999)
        expectRegistered()
        expect(storageRemove).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(1)
        await rejection

        expectCleanedUp(request.requestId)
        expect(vi.getTimerCount()).toBe(0)
    })

    it("does not settle or clean up twice when primary responds after a tab failure", async () => {
        const primary = deferred<unknown>()
        sendMessage.mockReturnValue(primary.promise)
        const pending = translateStructuredImageViaBackground({
            imageUrl: "https://example.test/image.png",
            targetLanguage: "zh-CN",
            modelId: "vision"
        })
        const request = getRequest()

        emitRuntime({
            type: "__translate_image_result__",
            requestId: request.requestId,
            response: {
                success: false,
                errorCode: "RATE_LIMITED",
                message: "private"
            }
        })
        await expect(pending).rejects.toEqual(
            new Error("请求过于频繁，请稍后重试")
        )
        primary.resolve({ success: true, result: strictResult })
        await Promise.resolve()

        expectCleanedUp(request.requestId)
    })

    it("isolates two concurrent requests by request ID and storage key", async () => {
        sendMessage
            .mockReturnValueOnce(new Promise(() => {}))
            .mockReturnValueOnce(new Promise(() => {}))
        const firstResult = { ...strictResult, modelId: "vision-a" }
        const secondResult = {
            ...strictResult,
            sourceWidth: 200,
            modelId: "vision-b"
        }
        const first = translateStructuredImageViaBackground({
            imageUrl: "https://example.test/a.png",
            targetLanguage: "zh-CN",
            modelId: "vision-a"
        })
        const second = translateStructuredImageViaBackground({
            imageUrl: "https://example.test/b.png",
            targetLanguage: "ja-JP",
            modelId: "vision-b"
        })
        const firstRequest = getRequest(0)
        const secondRequest = getRequest(1)
        expect(firstRequest.requestId).not.toBe(secondRequest.requestId)
        expectRegistered(2)

        emitRuntime({
            type: "__translate_image_result__",
            requestId: firstRequest.requestId,
            response: { success: true, result: firstResult }
        })
        expect(activeRuntimeListeners).toHaveLength(1)
        expect(activeStorageListeners).toHaveLength(1)
        emitStorage({
            [`__tr_result_${secondRequest.requestId}`]: {
                newValue: { success: true, result: secondResult }
            }
        })

        await expect(first).resolves.toEqual(firstResult)
        await expect(second).resolves.toEqual(secondResult)
        expect(activeRuntimeListeners).toHaveLength(0)
        expect(activeStorageListeners).toHaveLength(0)
        expect(runtimeRemoveListener).toHaveBeenCalledTimes(2)
        expect(storageRemoveListener).toHaveBeenCalledTimes(2)
        expect(storageRemove.mock.calls).toEqual([
            [`__tr_result_${firstRequest.requestId}`],
            [`__tr_result_${secondRequest.requestId}`]
        ])
    })

    it("ignores mismatched runtime IDs, storage areas, and storage keys", async () => {
        sendMessage.mockReturnValue(new Promise(() => {}))
        const pending = translateStructuredImageViaBackground({
            imageUrl: "https://example.test/image.png",
            targetLanguage: "zh-CN",
            modelId: "vision"
        })
        const request = getRequest()
        const storageKey = `__tr_result_${request.requestId}`

        emitRuntime({
            type: "__translate_image_result__",
            requestId: `${request.requestId}_other`,
            response: { success: true, result: strictResult }
        })
        emitStorage(
            {
                [storageKey]: {
                    newValue: { success: true, result: strictResult }
                }
            },
            "sync"
        )
        emitStorage({
            [`${storageKey}_other`]: {
                newValue: { success: true, result: strictResult }
            }
        })
        expectRegistered()
        expect(storageRemove).not.toHaveBeenCalled()

        emitRuntime({
            type: "__translate_image_result__",
            requestId: request.requestId,
            response: { success: true, result: strictResult }
        })

        await expect(pending).resolves.toEqual(strictResult)
        expectCleanedUp(request.requestId)
    })
})
