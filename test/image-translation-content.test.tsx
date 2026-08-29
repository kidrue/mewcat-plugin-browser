// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ImageTranslate } from "@/contents/imageTranslate"
import type { ImageTranslationResult } from "@/messaging/protocol"
import { AiModel_Platform_Enum } from "@/types/aiModel"

const usableVisionModel = {
    id: "vision-model",
    name: "Vision model",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    capabilities: { vision: true },
    params: {
        apiKey: "configured-key",
        isOfficial: true,
        modelName: "gpt-5"
    }
}

const mocks = vi.hoisted(() => ({
    config: {
        value: {
            enableImageTranslateButton: true,
            imageTranslationModelId: "vision-model",
            targetLanguage: "zh-CN",
            aiModelList: []
        }
    },
    translate: vi.fn(),
    createOverlay: vi.fn(),
    validateImage: vi.fn(() => ({ valid: true })),
    toast: vi.fn(),
    ensureCanvasHookInjected: vi.fn(() => Promise.resolve(false))
}))

vi.mock("jotai", () => ({
    useAtomValue: () => mocks.config.value
}))

vi.mock("@/state", () => ({ configAtom: {} }))

vi.mock("@/components/ImageTranslateButton", () => ({
    ImageTranslateButton: ({
        visible,
        translating,
        onClick,
        onMouseEnter,
        onMouseLeave
    }: {
        visible: boolean
        translating: boolean
        onClick: () => void
        onMouseEnter?: () => void
        onMouseLeave?: () => void
    }) =>
        React.createElement(
            "button",
            {
                "data-testid": "image-translate-button",
                "data-visible": String(visible),
                "data-translating": String(translating),
                onClick,
                onMouseEnter,
                onMouseLeave
            },
            translating ? "translating" : "translate"
        )
}))

vi.mock("@/contents/bridges/canvas-hook-bridge", () => ({
    ensureCanvasHookInjected: mocks.ensureCanvasHookInjected,
    ensureCanvasId: vi.fn(() => "canvas-id"),
    queryCanvasMeta: vi.fn(() => Promise.resolve(null))
}))

vi.mock("@/contents/imageTranslationOverlay", async importOriginal => ({
    ...(await importOriginal<
        typeof import("@/contents/imageTranslationOverlay")
    >()),
    createImageTranslationOverlay: mocks.createOverlay
}))

vi.mock("@/services/imageTranslation", () => ({
    translateStructuredImageViaBackground: mocks.translate,
    validateImage: mocks.validateImage
}))

vi.mock("@/utils/toast", () => ({
    Toast: { show: mocks.toast },
    ToastType: { ERROR: "error", SUCCESS: "success" }
}))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

const result: ImageTranslationResult = {
    sourceWidth: 100,
    sourceHeight: 100,
    modelId: "vision-model",
    cacheHit: false,
    blocks: []
}

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

describe("ImageTranslate content integration", () => {
    let root: Root
    let container: HTMLDivElement

    beforeEach(async () => {
        vi.useFakeTimers()
        Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
        document.body.replaceChildren()
        mocks.config.value = {
            enableImageTranslateButton: true,
            imageTranslationModelId: "vision-model",
            targetLanguage: "zh-CN",
            aiModelList: [usableVisionModel]
        }
        mocks.translate.mockReset()
        mocks.createOverlay.mockReset()
        mocks.createOverlay.mockImplementation(
            (_target, _translation, dependencies) => ({
                update: vi.fn(),
                destroy: vi.fn(() => dependencies.onDestroy?.())
            })
        )
        mocks.validateImage.mockClear()
        mocks.toast.mockReset()
        mocks.ensureCanvasHookInjected.mockClear()
        container = document.createElement("div")
        document.body.append(container)
        root = createRoot(container)
        await act(async () => {
            root.render(<ImageTranslate />)
        })
    })

    afterEach(async () => {
        await act(async () => {
            root.unmount()
        })
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    const showButtonFor = async (image: HTMLImageElement) => {
        document.body.append(image)
        await act(async () => {
            image.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
        })
        return container.querySelector<HTMLButtonElement>(
            '[data-testid="image-translate-button"]'
        )!
    }

    it.each([
        ["blank", " ", [usableVisionModel]],
        ["missing", "missing-model", [usableVisionModel]],
        [
            "disabled",
            "vision-model",
            [{ ...usableVisionModel, enabled: false }]
        ],
        [
            "missing API key",
            "vision-model",
            [
                {
                    ...usableVisionModel,
                    params: { ...usableVisionModel.params, apiKey: " " }
                }
            ]
        ],
        [
            "non-visual",
            "vision-model",
            [
                {
                    ...usableVisionModel,
                    type: AiModel_Platform_Enum.DEEPSEEK,
                    capabilities: { vision: false },
                    params: {
                        ...usableVisionModel.params,
                        modelName: "deepseek-chat"
                    }
                }
            ]
        ]
    ])(
        "does not register hover listeners or render a button for a %s model selection",
        async (_case, imageTranslationModelId, aiModelList) => {
            await act(async () => root.unmount())
            container.replaceChildren()
            mocks.config.value = {
                enableImageTranslateButton: true,
                imageTranslationModelId,
                targetLanguage: "zh-CN",
                aiModelList
            }
            const addEventListener = vi.spyOn(document, "addEventListener")
            root = createRoot(container)
            await act(async () => root.render(<ImageTranslate />))

            expect(addEventListener).not.toHaveBeenCalledWith(
                "mouseover",
                expect.any(Function)
            )
            expect(container.querySelector("button")).toBeNull()
            expect(mocks.validateImage).not.toHaveBeenCalled()
            expect(mocks.translate).not.toHaveBeenCalled()
        }
    )

    it("stops exposing the button when a previously valid model becomes blank", async () => {
        mocks.config.value.imageTranslationModelId = " "
        await act(async () => {
            root.render(<ImageTranslate />)
        })

        expect(container.querySelector("button")).toBeNull()
        expect(mocks.translate).not.toHaveBeenCalled()
    })

    it("uses the real controller to suppress in-flight clicks and restore a completed target", async () => {
        const pending = deferred<ImageTranslationResult>()
        const overlayDestroy = vi.fn()
        mocks.translate.mockReturnValue(pending.promise)
        mocks.createOverlay.mockImplementation(
            (_target, _translation, dependencies) => ({
                update: vi.fn(),
                destroy: vi.fn(() => {
                    overlayDestroy()
                    dependencies.onDestroy?.()
                })
            })
        )
        const button = await showButtonFor(document.createElement("img"))

        await act(async () => {
            button.click()
        })
        expect(button.dataset.translating).toBe("true")
        await act(async () => {
            button.click()
        })
        expect(mocks.translate).toHaveBeenCalledOnce()

        await act(async () => {
            pending.resolve(result)
            await pending.promise
        })
        expect(button.dataset.translating).toBe("false")
        expect(mocks.createOverlay).toHaveBeenCalledOnce()

        await act(async () => {
            button.click()
        })
        expect(overlayDestroy).toHaveBeenCalledOnce()
        expect(button.dataset.visible).toBe("false")
        expect(mocks.toast).toHaveBeenLastCalledWith({
            type: "success",
            message: "已恢复原图"
        })
    })

    it("cancels a pending translation and resets UI when the feature is disabled", async () => {
        const pending = deferred<ImageTranslationResult>()
        const overlayDestroy = vi.fn()
        mocks.translate
            .mockResolvedValueOnce(result)
            .mockReturnValueOnce(pending.promise)
        mocks.createOverlay.mockImplementation(
            (_target, _translation, dependencies) => ({
                update: vi.fn(),
                destroy: vi.fn(() => {
                    overlayDestroy()
                    dependencies.onDestroy?.()
                })
            })
        )
        const firstButton = await showButtonFor(document.createElement("img"))
        await act(async () => {
            firstButton.click()
        })
        expect(mocks.createOverlay).toHaveBeenCalledOnce()
        mocks.toast.mockClear()

        const button = await showButtonFor(document.createElement("img"))
        await act(async () => {
            button.click()
        })
        expect(button.dataset.translating).toBe("true")

        mocks.config.value = {
            ...mocks.config.value,
            enableImageTranslateButton: false
        }
        await act(async () => {
            root.render(<ImageTranslate />)
        })
        await act(async () => {
            pending.resolve(result)
            await pending.promise
        })

        expect(container.querySelector("button")).toBeNull()
        expect(mocks.createOverlay).toHaveBeenCalledOnce()
        expect(overlayDestroy).toHaveBeenCalledOnce()
        expect(mocks.toast).not.toHaveBeenCalled()
    })

    it("destroys overlays and clears the 300ms hide timer on unmount", async () => {
        const overlayDestroy = vi.fn()
        mocks.translate.mockResolvedValue(result)
        mocks.createOverlay.mockImplementation(
            (_target, _translation, dependencies) => ({
                update: vi.fn(),
                destroy: vi.fn(() => {
                    overlayDestroy()
                    dependencies.onDestroy?.()
                })
            })
        )
        const image = document.createElement("img")
        const button = await showButtonFor(image)
        await act(async () => {
            button.click()
        })
        await act(async () => {
            image.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
        })
        expect(vi.getTimerCount()).toBe(1)

        await act(async () => {
            root.unmount()
        })
        expect(overlayDestroy).toHaveBeenCalledOnce()
        expect(vi.getTimerCount()).toBe(0)
        root = createRoot(container)
    })

    it("does not show a Toast or create an overlay when a pending request settles after unmount", async () => {
        const pending = deferred<ImageTranslationResult>()
        mocks.translate.mockReturnValue(pending.promise)
        const button = await showButtonFor(document.createElement("img"))
        await act(async () => {
            button.click()
        })
        mocks.toast.mockClear()

        await act(async () => {
            root.unmount()
        })
        pending.resolve(result)
        await pending.promise
        await act(async () => {})

        expect(mocks.createOverlay).not.toHaveBeenCalled()
        expect(mocks.toast).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        root = createRoot(container)
    })

    it("does not show a Toast or create an overlay when a pending request rejects after unmount", async () => {
        const pending = deferred<ImageTranslationResult>()
        mocks.translate.mockReturnValue(pending.promise)
        const button = await showButtonFor(document.createElement("img"))
        await act(async () => {
            button.click()
        })
        mocks.toast.mockClear()

        await act(async () => {
            root.unmount()
        })
        pending.reject(new Error("late failure"))
        await expect(pending.promise).rejects.toThrow("late failure")
        await act(async () => {})

        expect(mocks.createOverlay).not.toHaveBeenCalled()
        expect(mocks.toast).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        root = createRoot(container)
    })

    it("resets translating when the target is removed while a request is pending", async () => {
        const pending = deferred<ImageTranslationResult>()
        mocks.translate.mockReturnValue(pending.promise)
        const image = document.createElement("img")
        const button = await showButtonFor(image)

        await act(async () => {
            button.click()
        })
        expect(button.dataset.translating).toBe("true")

        image.remove()
        await act(async () => {
            pending.resolve(result)
            await pending.promise
        })

        expect(button.dataset.translating).toBe("false")
        expect(button.dataset.visible).toBe("false")

        const nextButton = await showButtonFor(document.createElement("img"))
        expect(nextButton.dataset.visible).toBe("true")
    })

    it("uses production eligibility to keep the button hidden for individual rotation", async () => {
        const image = document.createElement("img")
        image.style.setProperty("rotate", "45deg")
        const button = await showButtonFor(image)

        expect(button.dataset.visible).toBe("false")
        expect(mocks.translate).not.toHaveBeenCalled()
    })

    it("rechecks production eligibility between hover and click", async () => {
        const image = document.createElement("img")
        const button = await showButtonFor(image)
        expect(button.dataset.visible).toBe("true")
        image.style.setProperty("rotate", "45deg")

        await act(async () => {
            button.click()
        })

        expect(mocks.translate).not.toHaveBeenCalled()
        expect(button.dataset.visible).toBe("false")
        expect(button.dataset.translating).toBe("false")
        expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({
            type: "error",
            message: "当前图片变换暂不支持翻译"
        })
    })

    it("rechecks production eligibility after a request resolves before creating an overlay", async () => {
        const pending = deferred<ImageTranslationResult>()
        mocks.translate.mockReturnValue(pending.promise)
        const image = document.createElement("img")
        const button = await showButtonFor(image)
        await act(async () => {
            button.click()
        })
        expect(button.dataset.translating).toBe("true")
        image.style.setProperty("scale", "-1 1")

        await act(async () => {
            pending.resolve(result)
            await pending.promise
        })

        expect(mocks.createOverlay).not.toHaveBeenCalled()
        expect(button.dataset.visible).toBe("false")
        expect(button.dataset.translating).toBe("false")
        expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({
            type: "error",
            message: "当前图片变换暂不支持翻译"
        })
    })
})
