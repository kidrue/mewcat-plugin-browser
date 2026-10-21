// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"

import { createImageTranslationController } from "@/contents/imageTranslationController"
import {
    createImageTranslationOverlay,
    hasSupportedTargetTransform
} from "@/contents/imageTranslationOverlay"
import type { ImageTranslationResult } from "@/messaging/protocol"

const target = {} as HTMLImageElement
const result: ImageTranslationResult = {
    sourceWidth: 100,
    sourceHeight: 100,
    modelId: "vision",
    cacheHit: false,
    blocks: []
}

describe("image translation controller", () => {
    it("does not request when no visual model is selected", async () => {
        const request = vi.fn()
        const controller = createImageTranslationController({
            createOverlay: vi.fn()
        })

        await expect(controller.translate(target, " ", request)).resolves.toBe(
            "missing-model"
        )
        expect(request).not.toHaveBeenCalled()
    })

    it("returns unsupported before requesting when production eligibility fails", async () => {
        const image = document.createElement("img")
        document.body.append(image)
        const request = vi.fn(() => Promise.resolve(result))
        const createOverlay = vi.fn(() => ({
            update: vi.fn(),
            destroy: vi.fn()
        }))
        const getStyle = () =>
            ({
                transform: "none",
                perspective: "none",
                rotate: "45deg",
                scale: "none",
                translate: "none"
            }) as CSSStyleDeclaration
        const controller = createImageTranslationController({
            createOverlay,
            isEligible: targetElement =>
                hasSupportedTargetTransform(targetElement, getStyle)
        })

        await expect(
            controller.translate(image, "vision", request)
        ).resolves.toBe("unsupported")
        expect(request).not.toHaveBeenCalled()
        expect(createOverlay).not.toHaveBeenCalled()
    })

    it("returns unsupported after resolving when production eligibility changes", async () => {
        const image = document.createElement("img")
        document.body.append(image)
        let resolveRequest!: (value: ImageTranslationResult) => void
        let rotate = "none"
        const request = vi.fn(
            () =>
                new Promise<ImageTranslationResult>(resolve => {
                    resolveRequest = resolve
                })
        )
        const createOverlay = vi.fn(() => ({
            update: vi.fn(),
            destroy: vi.fn()
        }))
        const getStyle = () =>
            ({
                transform: "none",
                perspective: "none",
                rotate,
                scale: "none",
                translate: "none"
            }) as CSSStyleDeclaration
        const controller = createImageTranslationController({
            createOverlay,
            isEligible: targetElement =>
                hasSupportedTargetTransform(targetElement, getStyle)
        })

        const pending = controller.translate(image, "vision", request)
        rotate = "45deg"
        resolveRequest(result)
        await expect(pending).resolves.toBe("unsupported")
        expect(createOverlay).not.toHaveBeenCalled()
    })

    it("suppresses concurrent requests and restores with a second click", async () => {
        let resolveRequest!: (result: ImageTranslationResult) => void
        const request = vi.fn(
            () =>
                new Promise<ImageTranslationResult>(
                    resolve => (resolveRequest = resolve)
                )
        )
        const destroy = vi.fn()
        const createOverlay = vi.fn(() => ({ update: vi.fn(), destroy }))
        const controller = createImageTranslationController({ createOverlay })

        const pending = controller.translate(target, "vision", request)
        await expect(
            controller.translate(target, "vision", request)
        ).resolves.toBe("in-flight")
        expect(request).toHaveBeenCalledTimes(1)
        resolveRequest(result)
        await expect(pending).resolves.toBe("created")
        await expect(
            controller.translate(target, "vision", request)
        ).resolves.toBe("restored")
        expect(destroy).toHaveBeenCalledOnce()
    })

    it("keeps the target untouched after request failure and destroys all active overlays", async () => {
        const destroy = vi.fn()
        const createOverlay = vi.fn(() => ({ update: vi.fn(), destroy }))
        const controller = createImageTranslationController({ createOverlay })
        const image = {
            src: "https://example.test/original.png",
            style: { opacity: "1" }
        } as unknown as HTMLImageElement

        await expect(
            controller.translate(image, "vision", () =>
                Promise.reject(new Error("failed"))
            )
        ).rejects.toThrow("failed")
        expect(image.src).toBe("https://example.test/original.png")
        expect(image.style.opacity).toBe("1")

        await controller.translate(target, "vision", () =>
            Promise.resolve(result)
        )
        controller.destroyAll()
        controller.destroyAll()
        expect(destroy).toHaveBeenCalledOnce()
    })

    it("cancels a pending request after destroyAll without creating an orphan overlay", async () => {
        let resolveRequest!: (value: ImageTranslationResult) => void
        const createOverlay = vi.fn(() => ({
            update: vi.fn(),
            destroy: vi.fn()
        }))
        const controller = createImageTranslationController({ createOverlay })
        const pending = controller.translate(
            target,
            "vision",
            () =>
                new Promise(resolve => {
                    resolveRequest = resolve
                })
        )
        controller.destroyAll()
        resolveRequest(result)
        await expect(pending).resolves.toBe("cancelled")
        expect(createOverlay).not.toHaveBeenCalled()
    })

    it("converts a cancelled request rejection into cancelled", async () => {
        let rejectRequest!: (reason: Error) => void
        const controller = createImageTranslationController({
            createOverlay: vi.fn()
        })
        const pending = controller.translate(
            target,
            "vision",
            () =>
                new Promise((_resolve, reject) => {
                    rejectRequest = reject
                })
        )
        controller.destroyAll()
        rejectRequest(new Error("late failure"))
        await expect(pending).resolves.toBe("cancelled")
    })

    it("cancels only the requested target while its request is pending", async () => {
        const image = document.createElement("img")
        document.body.append(image)
        let resolveRequest!: (value: ImageTranslationResult) => void
        const createOverlay = vi.fn()
        const controller = createImageTranslationController({ createOverlay })
        const pending = controller.translate(
            image,
            "vision",
            () =>
                new Promise(resolve => {
                    resolveRequest = resolve
                })
        )

        controller.destroy(image)
        resolveRequest(result)
        await expect(pending).resolves.toBe("cancelled")
        expect(createOverlay).not.toHaveBeenCalled()
    })

    it("does not create an overlay when the target is removed during the request", async () => {
        const image = document.createElement("img")
        document.body.append(image)
        let resolveRequest!: (value: ImageTranslationResult) => void
        const createOverlay = vi.fn()
        const controller = createImageTranslationController({ createOverlay })
        const pending = controller.translate(
            image,
            "vision",
            () =>
                new Promise(resolve => {
                    resolveRequest = resolve
                })
        )

        image.remove()
        resolveRequest(result)
        await expect(pending).resolves.toBe("cancelled")
        expect(createOverlay).not.toHaveBeenCalled()
        expect(
            document.querySelector("[data-mewcat-image-translation-overlay]")
        ).toBeNull()
    })

    it("releases controller ownership when an overlay destroys itself", async () => {
        const image = document.createElement("img")
        document.body.append(image)
        let notifyDestroyed!: () => void
        const createOverlay = vi.fn((_target, _result, onDestroy) => {
            notifyDestroyed = onDestroy
            return { update: vi.fn(), destroy: vi.fn() }
        })
        const request = vi.fn(() => Promise.resolve(result))
        const controller = createImageTranslationController({ createOverlay })

        await expect(
            controller.translate(image, "vision", request)
        ).resolves.toBe("created")
        notifyDestroyed()
        await expect(
            controller.translate(image, "vision", request)
        ).resolves.toBe("created")
        expect(request).toHaveBeenCalledTimes(2)
        expect(createOverlay).toHaveBeenCalledTimes(2)
    })

    it("allows a new request after destroyAll without an older request taking ownership", async () => {
        const image = document.createElement("img")
        document.body.append(image)
        let resolveOld!: (value: ImageTranslationResult) => void
        let resolveNew!: (value: ImageTranslationResult) => void
        const createOverlay = vi.fn(() => ({
            update: vi.fn(),
            destroy: vi.fn()
        }))
        const controller = createImageTranslationController({ createOverlay })
        const oldPending = controller.translate(
            image,
            "vision",
            () => new Promise(resolve => (resolveOld = resolve))
        )
        controller.destroyAll()
        const newPending = controller.translate(
            image,
            "vision",
            () => new Promise(resolve => (resolveNew = resolve))
        )

        resolveNew(result)
        await expect(newPending).resolves.toBe("created")
        resolveOld(result)
        await expect(oldPending).resolves.toBe("cancelled")
        expect(createOverlay).toHaveBeenCalledOnce()
    })

    it("drops ownership after the actual overlay removes a detached target", async () => {
        let mutationCallback!: MutationCallback
        const onDestroy = vi.fn()
        class FakeMutationObserver {
            constructor(callback: MutationCallback) {
                mutationCallback = callback
            }
            observe() {}
            disconnect() {}
        }
        const controller = createImageTranslationController({
            createOverlay: (overlayTarget, translation, notifyDestroyed) =>
                createImageTranslationOverlay(overlayTarget, translation, {
                    MutationObserver:
                        FakeMutationObserver as unknown as typeof MutationObserver,
                    onDestroy: () => {
                        onDestroy()
                        notifyDestroyed()
                    }
                })
        })
        const image = document.createElement("img")
        document.body.append(image)
        Object.defineProperties(image, {
            offsetWidth: { value: 100 },
            offsetHeight: { value: 100 }
        })

        await expect(
            controller.translate(image, "vision", () => Promise.resolve(result))
        ).resolves.toBe("created")
        expect(
            document.querySelectorAll("[data-mewcat-image-translation-overlay]")
        ).toHaveLength(1)
        image.remove()
        mutationCallback([], {} as MutationObserver)
        expect(
            document.querySelector("[data-mewcat-image-translation-overlay]")
        ).toBeNull()
        expect(onDestroy).toHaveBeenCalledOnce()

        document.body.append(image)
        await expect(
            controller.translate(image, "vision", () => Promise.resolve(result))
        ).resolves.toBe("created")
        expect(
            document.querySelectorAll("[data-mewcat-image-translation-overlay]")
        ).toHaveLength(1)
        controller.destroyAll()
    })
})
