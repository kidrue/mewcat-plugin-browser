// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"

import {
    createImageTranslationOverlay,
    getObjectFitContentRect,
    getOverlayTextStyle,
    hasSupportedTargetTransform,
    isAxisAlignedTransform,
    projectNormalizedBox
} from "@/contents/imageTranslationOverlay"
import type { ImageTranslationResult } from "@/messaging/protocol"

const result: ImageTranslationResult = {
    sourceWidth: 1000,
    sourceHeight: 500,
    modelId: "vision-model",
    cacheHit: false,
    blocks: [
        {
            box: [100, 200, 500, 800],
            sourceText: "source",
            translatedText: "译文",
            writingMode: "horizontal",
            backgroundColor: "rgb(12, 34, 56)",
            textColor: "#ffffff"
        }
    ]
}

afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
})

describe("image translation overlay layout", () => {
    it("maps contain and cover image content with object position", () => {
        expect(
            getObjectFitContentRect({
                boxWidth: 200,
                boxHeight: 200,
                sourceWidth: 1000,
                sourceHeight: 500,
                objectFit: "contain",
                objectPosition: "center"
            })
        ).toEqual({ left: 0, top: 50, width: 200, height: 100 })
        expect(
            getObjectFitContentRect({
                boxWidth: 200,
                boxHeight: 200,
                sourceWidth: 1000,
                sourceHeight: 500,
                objectFit: "cover",
                objectPosition: "right bottom"
            })
        ).toEqual({ left: -200, top: 0, width: 400, height: 200 })
        expect(
            projectNormalizedBox([0, 0, 1000, 1000], {
                left: -200,
                top: 0,
                width: 400,
                height: 200
            })
        ).toEqual({ left: -200, top: 0, width: 400, height: 200 })
    })

    it("accepts only axis-aligned transforms", () => {
        expect(isAxisAlignedTransform("none")).toBe(true)
        expect(isAxisAlignedTransform("matrix(2, 0, 0, 3, 8, 9)")).toBe(true)
        expect(isAxisAlignedTransform("matrix(1, 0.2, 0, 1, 0, 0)")).toBe(false)
        expect(
            isAxisAlignedTransform(
                "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0.1, 1)"
            )
        ).toBe(false)
    })

    it("supports every object-fit mode and common object-position values", () => {
        const base = {
            boxWidth: 200,
            boxHeight: 200,
            sourceWidth: 1000,
            sourceHeight: 500,
            objectPosition: "center"
        }
        expect(getObjectFitContentRect({ ...base, objectFit: "fill" })).toEqual(
            { left: 0, top: 0, width: 200, height: 200 }
        )
        expect(
            getObjectFitContentRect({ ...base, objectFit: "contain" })
        ).toEqual({ left: 0, top: 50, width: 200, height: 100 })
        expect(
            getObjectFitContentRect({ ...base, objectFit: "cover" })
        ).toEqual({ left: -100, top: 0, width: 400, height: 200 })
        expect(getObjectFitContentRect({ ...base, objectFit: "none" })).toEqual(
            { left: -400, top: -150, width: 1000, height: 500 }
        )
        expect(
            getObjectFitContentRect({ ...base, objectFit: "scale-down" })
        ).toEqual({ left: 0, top: 50, width: 200, height: 100 })
        expect(
            getObjectFitContentRect({
                ...base,
                objectFit: "cover",
                objectPosition: "25% 75%"
            })
        ).toEqual({ left: -50, top: 0, width: 400, height: 200 })
        expect(
            getObjectFitContentRect({
                ...base,
                objectFit: "contain",
                objectPosition: "left 10px"
            })
        ).toEqual({ left: 0, top: 10, width: 200, height: 100 })
    })

    it("renders rounded translated text without changing the target and cleans up", () => {
        const image = document.createElement("img")
        image.src = "https://example.test/original.png"
        image.style.opacity = "0.7"
        document.body.append(image)
        Object.defineProperties(image, {
            offsetWidth: { value: 200 },
            offsetHeight: { value: 100 }
        })
        vi.spyOn(image, "getBoundingClientRect").mockReturnValue({
            left: 10,
            top: 20,
            right: 210,
            bottom: 120,
            width: 200,
            height: 100,
            x: 10,
            y: 20,
            toJSON: () => ({})
        })

        const overlay = createImageTranslationOverlay(image, result, {
            getComputedStyle: () =>
                ({
                    objectFit: "fill",
                    objectPosition: "50% 50%",
                    paddingLeft: "0px",
                    paddingTop: "0px",
                    paddingRight: "0px",
                    paddingBottom: "0px",
                    borderLeftWidth: "0px",
                    borderTopWidth: "0px",
                    borderRightWidth: "0px",
                    borderBottomWidth: "0px",
                    borderRadius: "8px",
                    transform: "none"
                }) as CSSStyleDeclaration
        })

        const root = document.querySelector<HTMLElement>(
            "[data-mewcat-image-translation-overlay]"
        )
        const block = root?.querySelector<HTMLElement>(
            "[data-mewcat-image-translation-block]"
        )
        expect(root).not.toBeNull()
        expect(root?.style.pointerEvents).toBe("none")
        expect(block?.textContent).toBe("译文")
        expect(block?.style.backgroundColor).toBe("rgba(12, 34, 56, 0.92)")
        expect(block?.style.color).toBe("rgb(255, 255, 255)")
        expect(block?.style.borderRadius).not.toBe("")
        expect(image.src).toBe("https://example.test/original.png")
        expect(image.style.opacity).toBe("0.7")

        overlay.destroy()
        overlay.destroy()
        expect(
            document.querySelector("[data-mewcat-image-translation-overlay]")
        ).toBeNull()
    })

    it("updates vertical blocks through coalesced observers and removes itself when the target leaves", () => {
        const callbacks: Array<() => void> = []
        let resizeCallback: (() => void) | undefined
        let mutationCallback: (() => void) | undefined
        class FakeResizeObserver {
            constructor(callback: () => void) {
                resizeCallback = callback
            }
            observe() {}
            disconnect() {}
        }
        class FakeMutationObserver {
            constructor(callback: () => void) {
                mutationCallback = callback
            }
            observe() {}
            disconnect() {}
        }
        const canvas = document.createElement("canvas")
        document.body.append(canvas)
        Object.defineProperties(canvas, {
            offsetWidth: { value: 200 },
            offsetHeight: { value: 100 }
        })
        vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
            left: 0,
            top: 0,
            right: 200,
            bottom: 100,
            width: 200,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({})
        })
        const overlay = createImageTranslationOverlay(
            canvas,
            {
                ...result,
                blocks: [
                    {
                        ...result.blocks[0],
                        translatedText: "縦書き",
                        writingMode: "vertical",
                        backgroundColor: "#123456"
                    }
                ]
            },
            {
                requestAnimationFrame: callback => {
                    callbacks.push(() => callback(0))
                    return callbacks.length
                },
                cancelAnimationFrame: vi.fn(),
                ResizeObserver:
                    FakeResizeObserver as unknown as typeof ResizeObserver,
                MutationObserver:
                    FakeMutationObserver as unknown as typeof MutationObserver
            }
        )
        const root = document.querySelector<HTMLElement>(
            "[data-mewcat-image-translation-overlay]"
        )!
        expect(
            root.querySelector<HTMLElement>(
                "[data-mewcat-image-translation-block]"
            )?.style.writingMode
        ).toBe("vertical-rl")
        resizeCallback?.()
        window.dispatchEvent(new Event("resize"))
        expect(callbacks).toHaveLength(1)
        callbacks[0]()
        overlay.update({ ...result, blocks: [] })
        expect(callbacks).toHaveLength(2)
        callbacks[1]()
        expect(root.children).toHaveLength(0)
        canvas.remove()
        mutationCallback?.()
        expect(
            document.querySelector("[data-mewcat-image-translation-overlay]")
        ).toBeNull()
    })

    it("projects untransformed contain geometry through nonuniform scale and asymmetric insets", () => {
        const image = document.createElement("img")
        document.body.append(image)
        Object.defineProperties(image, {
            offsetWidth: { value: 200 },
            offsetHeight: { value: 200 }
        })
        vi.spyOn(image, "getBoundingClientRect").mockReturnValue({
            left: 10,
            top: 20,
            right: 410,
            bottom: 220,
            width: 400,
            height: 200,
            x: 10,
            y: 20,
            toJSON: () => ({})
        })
        createImageTranslationOverlay(image, result, {
            getComputedStyle: element =>
                ({
                    objectFit: "contain",
                    objectPosition: "center",
                    borderLeftWidth: "5px",
                    borderTopWidth: "4px",
                    borderRightWidth: "7px",
                    borderBottomWidth: "6px",
                    paddingLeft: "10px",
                    paddingTop: "8px",
                    paddingRight: "12px",
                    paddingBottom: "14px",
                    borderRadius: "0",
                    transform:
                        element === image ? "matrix(2, 0, 0, 1, 4, 5)" : "none",
                    perspective: "none"
                }) as CSSStyleDeclaration
        })
        const root = document.querySelector<HTMLElement>(
            "[data-mewcat-image-translation-overlay]"
        )!
        const block = root.firstElementChild as HTMLElement
        expect([
            root.style.left,
            root.style.top,
            root.style.width,
            root.style.height
        ]).toEqual(["40px", "32px", "332px", "168px"])
        expect([
            block.style.left,
            block.style.top,
            block.style.width,
            block.style.height
        ]).toEqual(["66.4px", "50.8px", "199.2px", "33.2px"])
    })

    it("accepts positive axis scale/translation but rejects reflection, rotation, 3d and perspective", () => {
        expect(isAxisAlignedTransform("matrix(2, 0, 0, 3, 10, 20)")).toBe(true)
        expect(isAxisAlignedTransform("matrix(-1, 0, 0, -1, 0, 0)")).toBe(false)
        expect(isAxisAlignedTransform("matrix(1, 0.1, 0, 1, 0, 0)")).toBe(false)
        expect(
            isAxisAlignedTransform(
                "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0.1, 0, 0, 0, 1)"
            )
        ).toBe(false)
    })

    it("handles vertical-first positions, portrait modes and scale-down without scaling", () => {
        const base = {
            boxWidth: 200,
            boxHeight: 200,
            sourceWidth: 1000,
            sourceHeight: 500
        }
        expect(
            getObjectFitContentRect({
                ...base,
                objectFit: "contain",
                objectPosition: "top right"
            })
        ).toEqual({ left: 0, top: 0, width: 200, height: 100 })
        expect(
            getObjectFitContentRect({
                ...base,
                objectFit: "contain",
                objectPosition: "top 25%"
            })
        ).toEqual({ left: 0, top: 0, width: 200, height: 100 })
        expect(
            getObjectFitContentRect({
                ...base,
                objectFit: "cover",
                objectPosition: "bottom left"
            })
        ).toEqual({ left: 0, top: 0, width: 400, height: 200 })
        expect(
            getObjectFitContentRect({
                boxWidth: 300,
                boxHeight: 300,
                sourceWidth: 100,
                sourceHeight: 200,
                objectFit: "scale-down",
                objectPosition: "center"
            })
        ).toEqual({ left: 100, top: 50, width: 100, height: 200 })
        expect(
            getObjectFitContentRect({
                boxWidth: 200,
                boxHeight: 100,
                sourceWidth: 500,
                sourceHeight: 1000,
                objectFit: "contain",
                objectPosition: "center"
            })
        ).toEqual({ left: 75, top: 0, width: 50, height: 100 })
    })

    it("rejects CSS perspective on a target or ancestor", () => {
        const parent = document.createElement("div")
        const image = document.createElement("img")
        parent.append(image)
        document.body.append(parent)
        const style = vi.fn(
            (element: Element) =>
                ({
                    transform: "none",
                    perspective: element === parent ? "800px" : "none"
                }) as CSSStyleDeclaration
        )
        expect(hasSupportedTargetTransform(image, style)).toBe(false)
    })

    it("accepts target and ancestor static individual translation, zero rotation and positive axis scale", () => {
        const parent = document.createElement("div")
        const image = document.createElement("img")
        parent.append(image)
        document.body.append(parent)
        const style = (element: Element) =>
            ({
                transform: "none",
                perspective: "none",
                rotate: element === image ? "0deg" : "none",
                scale:
                    element === parent
                        ? "2 3"
                        : element === image
                          ? "1.5 4"
                          : "none",
                translate:
                    element === image
                        ? "10px -25%"
                        : element === parent
                          ? "-2rem 3vh"
                          : "none"
            }) as CSSStyleDeclaration

        expect(hasSupportedTargetTransform(image, style)).toBe(true)
    })

    it.each([
        ["target rotate", "rotate", "45deg", "target"],
        ["ancestor rotate", "rotate", "0.25turn", "ancestor"],
        ["target reflection", "scale", "-1 1", "target"],
        ["ancestor reflection", "scale", "1 -1", "ancestor"],
        ["ancestor zero scale", "scale", "1 0", "ancestor"],
        ["unparseable rotate", "rotate", "sideways", "target"],
        ["unparseable scale", "scale", "large", "ancestor"],
        ["unparseable translate", "translate", "somewhere", "target"]
    ] as const)("rejects individual %s", (_label, property, value, owner) => {
        const parent = document.createElement("div")
        const image = document.createElement("img")
        parent.append(image)
        document.body.append(parent)
        const style = (element: Element) =>
            ({
                transform: "none",
                perspective: "none",
                rotate:
                    property === "rotate" &&
                    element === (owner === "target" ? image : parent)
                        ? value
                        : "none",
                scale:
                    property === "scale" &&
                    element === (owner === "target" ? image : parent)
                        ? value
                        : "none",
                translate:
                    property === "translate" &&
                    element === (owner === "target" ? image : parent)
                        ? value
                        : "none"
            }) as CSSStyleDeclaration

        expect(hasSupportedTargetTransform(image, style)).toBe(false)
    })

    it.each([
        [
            "body matrix translation",
            document.body,
            "transform",
            "matrix(1, 0, 0, 1, 8, 9)"
        ],
        [
            "html matrix scale",
            document.documentElement,
            "transform",
            "matrix(2, 0, 0, 3, 0, 0)"
        ],
        ["body individual translation", document.body, "translate", "8px 9px"],
        ["html individual scale", document.documentElement, "scale", "2 3"],
        ["body individual rotation", document.body, "rotate", "10deg"],
        ["html perspective", document.documentElement, "perspective", "800px"]
    ] as const)(
        "rejects a fixed containing-block boundary on %s",
        (_label, rootElement, property, value) => {
            const image = document.createElement("img")
            document.body.append(image)
            const style = (element: Element) =>
                ({
                    transform:
                        element === rootElement && property === "transform"
                            ? value
                            : "none",
                    perspective:
                        element === rootElement && property === "perspective"
                            ? value
                            : "none",
                    rotate:
                        element === rootElement && property === "rotate"
                            ? value
                            : "none",
                    scale:
                        element === rootElement && property === "scale"
                            ? value
                            : "none",
                    translate:
                        element === rootElement && property === "translate"
                            ? value
                            : "none"
                }) as CSSStyleDeclaration

            expect(hasSupportedTargetTransform(image, style)).toBe(false)
        }
    )

    it("destroys an active overlay when a target class/style mutation makes its transform unsupported", () => {
        let mutationCallback!: MutationCallback
        let rotate = "none"
        class FakeMutationObserver {
            constructor(callback: MutationCallback) {
                mutationCallback = callback
            }
            observe() {}
            disconnect() {}
        }
        const image = document.createElement("img")
        document.body.append(image)
        Object.defineProperties(image, {
            offsetWidth: { value: 200 },
            offsetHeight: { value: 100 }
        })
        vi.spyOn(image, "getBoundingClientRect").mockReturnValue({
            left: 0,
            top: 0,
            right: 200,
            bottom: 100,
            width: 200,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({})
        })
        const onDestroy = vi.fn()
        createImageTranslationOverlay(image, result, {
            getComputedStyle: () =>
                ({
                    transform: "none",
                    perspective: "none",
                    rotate,
                    scale: "none",
                    translate: "none"
                }) as CSSStyleDeclaration,
            MutationObserver:
                FakeMutationObserver as unknown as typeof MutationObserver,
            onDestroy
        })

        rotate = "45deg"
        mutationCallback(
            [
                {
                    type: "attributes",
                    attributeName: "class",
                    target: image
                } as unknown as MutationRecord
            ],
            {} as MutationObserver
        )

        expect(
            document.querySelector("[data-mewcat-image-translation-overlay]")
        ).toBeNull()
        expect(onDestroy).toHaveBeenCalledOnce()
    })

    it("destroys an active overlay when an ancestor style mutation makes its transform unsupported", () => {
        let mutationCallback!: MutationCallback
        let ancestorScale = "none"
        class FakeMutationObserver {
            constructor(callback: MutationCallback) {
                mutationCallback = callback
            }
            observe() {}
            disconnect() {}
        }
        const parent = document.createElement("div")
        const image = document.createElement("img")
        parent.append(image)
        document.body.append(parent)
        createImageTranslationOverlay(image, result, {
            getComputedStyle: element =>
                ({
                    transform: "none",
                    perspective: "none",
                    rotate: "none",
                    scale: element === parent ? ancestorScale : "none",
                    translate: "none"
                }) as CSSStyleDeclaration,
            MutationObserver:
                FakeMutationObserver as unknown as typeof MutationObserver
        })

        ancestorScale = "-1 1"
        mutationCallback(
            [
                {
                    type: "attributes",
                    attributeName: "style",
                    target: parent
                } as unknown as MutationRecord
            ],
            {} as MutationObserver
        )

        expect(
            document.querySelector("[data-mewcat-image-translation-overlay]")
        ).toBeNull()
    })

    it("destroys for transform transitions or ancestor animations and removes lifecycle listeners exactly", () => {
        const parent = document.createElement("div")
        const image = document.createElement("img")
        parent.append(image)
        document.body.append(parent)
        Object.defineProperties(image, {
            offsetWidth: { value: 100 },
            offsetHeight: { value: 100 }
        })
        const addListener = vi.spyOn(document, "addEventListener")
        const removeListener = vi.spyOn(document, "removeEventListener")
        const first = createImageTranslationOverlay(image, result)

        const transition = new Event("transitionstart", { bubbles: true })
        Object.defineProperty(transition, "propertyName", {
            value: "transform"
        })
        parent.dispatchEvent(transition)
        expect(
            document.querySelector("[data-mewcat-image-translation-overlay]")
        ).toBeNull()

        const second = createImageTranslationOverlay(image, result)
        parent.dispatchEvent(new Event("animationstart", { bubbles: true }))
        expect(
            document.querySelector("[data-mewcat-image-translation-overlay]")
        ).toBeNull()
        first.destroy()
        second.destroy()

        for (const type of [
            "transitionrun",
            "transitionstart",
            "animationstart"
        ]) {
            expect(
                addListener.mock.calls.filter(
                    ([eventType]) => eventType === type
                )
            ).toHaveLength(2)
            expect(
                removeListener.mock.calls.filter(
                    ([eventType]) => eventType === type
                )
            ).toHaveLength(2)
        }
    })

    it("projects an ancestor-only nonuniform scale using the target's untransformed box", () => {
        const parent = document.createElement("div")
        const image = document.createElement("img")
        parent.append(image)
        document.body.append(parent)
        Object.defineProperties(image, {
            offsetWidth: { value: 200 },
            offsetHeight: { value: 200 }
        })
        vi.spyOn(image, "getBoundingClientRect").mockReturnValue({
            left: 10,
            top: 20,
            right: 410,
            bottom: 620,
            width: 400,
            height: 600,
            x: 10,
            y: 20,
            toJSON: () => ({})
        })
        const style = (element: Element) =>
            ({
                objectFit: "contain",
                objectPosition: "center",
                borderLeftWidth: "0",
                borderTopWidth: "0",
                borderRightWidth: "0",
                borderBottomWidth: "0",
                paddingLeft: "0",
                paddingTop: "0",
                paddingRight: "0",
                paddingBottom: "0",
                borderRadius: "0",
                perspective: "none",
                transform:
                    element === parent ? "matrix(2, 0, 0, 3, 8, 9)" : "none"
            }) as CSSStyleDeclaration
        expect(hasSupportedTargetTransform(image, style)).toBe(true)
        createImageTranslationOverlay(image, result, {
            getComputedStyle: style
        })
        const root = document.querySelector<HTMLElement>(
            "[data-mewcat-image-translation-overlay]"
        )!
        const block = root.firstElementChild as HTMLElement
        expect([
            root.style.left,
            root.style.top,
            root.style.width,
            root.style.height
        ]).toEqual(["10px", "20px", "400px", "600px"])
        expect([
            block.style.left,
            block.style.top,
            block.style.width,
            block.style.height
        ]).toEqual(["80px", "180px", "240px", "120px"])
    })

    it.each([["offsetWidth", "offsetHeight"]] as const)(
        "hides without NaN when %s or %s is zero",
        (widthKey, heightKey) => {
            const image = document.createElement("img")
            document.body.append(image)
            Object.defineProperties(image, {
                [widthKey]: { value: 0 },
                [heightKey]: { value: 0 }
            })
            vi.spyOn(image, "getBoundingClientRect").mockReturnValue({
                left: 1,
                top: 2,
                right: 201,
                bottom: 102,
                width: 200,
                height: 100,
                x: 1,
                y: 2,
                toJSON: () => ({})
            })
            createImageTranslationOverlay(image, result)
            const root = document.querySelector<HTMLElement>(
                "[data-mewcat-image-translation-overlay]"
            )!
            expect(root.style.display).toBe("none")
            expect(root.getAttribute("style")).not.toMatch(/NaN|Infinity/)
        }
    )

    it("keeps horizontal and vertical font sizing deterministic and bounded", () => {
        expect(getOverlayTextStyle(120, 40, "abcdefgh", "horizontal")).toEqual({
            fontSize: 28.8,
            writingMode: "horizontal-tb"
        })
        expect(getOverlayTextStyle(20, 200, "abcdefgh", "vertical")).toEqual({
            fontSize: 14.4,
            writingMode: "vertical-rl"
        })
        expect(
            getOverlayTextStyle(1, 1, "a very long translation", "horizontal")
                .fontSize
        ).toBe(10)
        expect(getOverlayTextStyle(1000, 1000, "x", "vertical").fontSize).toBe(
            32
        )
    })

    it("coalesces scroll, resize, image load, observer and update work and cleans every resource exactly once", () => {
        const frames = new Map<number, FrameRequestCallback>()
        const requestFrame = vi.fn((callback: FrameRequestCallback) => {
            const handle = 40 + frames.size + 1
            frames.set(handle, callback)
            return handle
        })
        const cancelFrame = vi.fn((handle: number) => frames.delete(handle))
        const resizeObserve = vi.fn()
        const resizeDisconnect = vi.fn()
        const mutationObserve = vi.fn()
        const mutationDisconnect = vi.fn()
        let resizeCallback!: ResizeObserverCallback
        class FakeResizeObserver {
            constructor(callback: ResizeObserverCallback) {
                resizeCallback = callback
            }
            observe = resizeObserve
            disconnect = resizeDisconnect
        }
        class FakeMutationObserver {
            constructor() {}
            observe = mutationObserve
            disconnect = mutationDisconnect
        }
        const addWindowListener = vi.spyOn(window, "addEventListener")
        const removeWindowListener = vi.spyOn(window, "removeEventListener")
        const image = document.createElement("img")
        document.body.append(image)
        Object.defineProperties(image, {
            offsetWidth: { value: 200 },
            offsetHeight: { value: 100 }
        })
        vi.spyOn(image, "getBoundingClientRect").mockReturnValue({
            left: 0,
            top: 0,
            right: 200,
            bottom: 100,
            width: 200,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({})
        })
        const addTargetListener = vi.spyOn(image, "addEventListener")
        const removeTargetListener = vi.spyOn(image, "removeEventListener")
        const onDestroy = vi.fn()
        const overlay = createImageTranslationOverlay(image, result, {
            requestAnimationFrame: requestFrame,
            cancelAnimationFrame: cancelFrame,
            ResizeObserver:
                FakeResizeObserver as unknown as typeof ResizeObserver,
            MutationObserver:
                FakeMutationObserver as unknown as typeof MutationObserver,
            onDestroy
        })

        expect(resizeObserve).toHaveBeenCalledExactlyOnceWith(image)
        expect(mutationObserve).toHaveBeenCalledExactlyOnceWith(
            document.documentElement,
            {
                attributes: true,
                attributeFilter: ["class", "style"],
                childList: true,
                subtree: true
            }
        )
        expect(
            addWindowListener.mock.calls.filter(([type]) => type === "scroll")
        ).toEqual([["scroll", expect.any(Function), true]])
        expect(
            addWindowListener.mock.calls.filter(([type]) => type === "resize")
        ).toEqual([["resize", expect.any(Function)]])
        expect(addTargetListener).toHaveBeenCalledExactlyOnceWith(
            "load",
            expect.any(Function)
        )

        window.dispatchEvent(new Event("scroll"))
        window.dispatchEvent(new Event("resize"))
        image.dispatchEvent(new Event("load"))
        resizeCallback([], {} as ResizeObserver)
        overlay.update()
        expect(requestFrame).toHaveBeenCalledOnce()
        frames.get(41)?.(0)
        frames.delete(41)

        resizeCallback([], {} as ResizeObserver)
        expect(requestFrame).toHaveBeenCalledTimes(2)
        frames.get(41)?.(0)
        frames.delete(41)
        window.dispatchEvent(new Event("resize"))
        expect(requestFrame).toHaveBeenCalledTimes(3)
        frames.get(41)?.(0)
        frames.delete(41)
        image.dispatchEvent(new Event("load"))
        expect(requestFrame).toHaveBeenCalledTimes(4)
        frames.get(41)?.(0)
        frames.delete(41)
        overlay.update()
        expect(requestFrame).toHaveBeenCalledTimes(5)

        overlay.destroy()
        overlay.destroy()
        expect(cancelFrame).toHaveBeenCalledExactlyOnceWith(41)
        expect(resizeDisconnect).toHaveBeenCalledOnce()
        expect(mutationDisconnect).toHaveBeenCalledOnce()
        expect(
            removeWindowListener.mock.calls.filter(
                ([type]) => type === "scroll"
            )
        ).toEqual([["scroll", expect.any(Function), true]])
        expect(
            removeWindowListener.mock.calls.filter(
                ([type]) => type === "resize"
            )
        ).toEqual([["resize", expect.any(Function)]])
        expect(removeTargetListener).toHaveBeenCalledExactlyOnceWith(
            "load",
            expect.any(Function)
        )
        expect(onDestroy).toHaveBeenCalledOnce()
    })

    it("recovers a zero-size overlay after ResizeObserver reports usable dimensions", () => {
        let width = 0
        let height = 0
        let resizeCallback!: ResizeObserverCallback
        let pendingFrame: FrameRequestCallback | undefined
        class FakeResizeObserver {
            constructor(callback: ResizeObserverCallback) {
                resizeCallback = callback
            }
            observe() {}
            disconnect() {}
        }
        const image = document.createElement("img")
        document.body.append(image)
        Object.defineProperties(image, {
            offsetWidth: { get: () => width },
            offsetHeight: { get: () => height }
        })
        vi.spyOn(image, "getBoundingClientRect").mockImplementation(() => ({
            left: 5,
            top: 6,
            right: 5 + width,
            bottom: 6 + height,
            width,
            height,
            x: 5,
            y: 6,
            toJSON: () => ({})
        }))
        createImageTranslationOverlay(image, result, {
            requestAnimationFrame: callback => {
                pendingFrame = callback
                return 7
            },
            ResizeObserver:
                FakeResizeObserver as unknown as typeof ResizeObserver
        })
        const root = document.querySelector<HTMLElement>(
            "[data-mewcat-image-translation-overlay]"
        )!
        expect(root.style.display).toBe("none")

        width = 200
        height = 100
        resizeCallback([], {} as ResizeObserver)
        pendingFrame?.(0)
        expect(root.style.display).toBe("block")
        expect([root.style.left, root.style.top, root.style.width]).toEqual([
            "5px",
            "6px",
            "200px"
        ])
    })

    it("removes a detached target root and reports destruction once", () => {
        let mutationCallback!: MutationCallback
        const resizeDisconnect = vi.fn()
        const mutationDisconnect = vi.fn()
        class FakeResizeObserver {
            constructor() {}
            observe() {}
            disconnect = resizeDisconnect
        }
        class FakeMutationObserver {
            constructor(callback: MutationCallback) {
                mutationCallback = callback
            }
            observe() {}
            disconnect = mutationDisconnect
        }
        const canvas = document.createElement("canvas")
        document.body.append(canvas)
        Object.defineProperties(canvas, {
            offsetWidth: { value: 100 },
            offsetHeight: { value: 100 }
        })
        const onDestroy = vi.fn()
        const overlay = createImageTranslationOverlay(canvas, result, {
            ResizeObserver:
                FakeResizeObserver as unknown as typeof ResizeObserver,
            MutationObserver:
                FakeMutationObserver as unknown as typeof MutationObserver,
            onDestroy
        })

        canvas.remove()
        mutationCallback([], {} as MutationObserver)
        overlay.destroy()
        expect(
            document.querySelector("[data-mewcat-image-translation-overlay]")
        ).toBeNull()
        expect(resizeDisconnect).toHaveBeenCalledOnce()
        expect(mutationDisconnect).toHaveBeenCalledOnce()
        expect(onDestroy).toHaveBeenCalledOnce()
    })

    it("replaces blocks without duplicating roots or listeners and preserves image state", () => {
        const callbacks: FrameRequestCallback[] = []
        const image = document.createElement("img")
        image.src = "https://example.test/original.png"
        image.style.cssText = "opacity: 0.73; border: 2px solid red;"
        document.body.append(image)
        Object.defineProperties(image, {
            offsetWidth: { value: 200 },
            offsetHeight: { value: 100 }
        })
        vi.spyOn(image, "getBoundingClientRect").mockReturnValue({
            left: 0,
            top: 0,
            right: 200,
            bottom: 100,
            width: 200,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({})
        })
        const initialSrc = image.src
        const initialStyle = image.style.cssText
        const addListener = vi.spyOn(window, "addEventListener")
        const overlay = createImageTranslationOverlay(image, result, {
            requestAnimationFrame: callback => {
                callbacks.push(callback)
                return callbacks.length
            }
        })
        const listenerCount = addListener.mock.calls.length
        overlay.update({
            ...result,
            blocks: [
                result.blocks[0],
                { ...result.blocks[0], translatedText: "二" }
            ]
        })
        callbacks[0](0)

        expect(
            document.querySelectorAll("[data-mewcat-image-translation-overlay]")
        ).toHaveLength(1)
        expect(
            document.querySelectorAll("[data-mewcat-image-translation-block]")
        ).toHaveLength(2)
        expect(addListener).toHaveBeenCalledTimes(listenerCount)
        expect(image.src).toBe(initialSrc)
        expect(image.style.cssText).toBe(initialStyle)
        overlay.destroy()
        expect(image.src).toBe(initialSrc)
        expect(image.style.cssText).toBe(initialStyle)
    })

    it("never reads or changes canvas pixels, dimensions, opacity or inline styles", () => {
        const canvas = document.createElement("canvas")
        canvas.width = 320
        canvas.height = 180
        canvas.style.cssText = "opacity: 0.41; border: 1px solid blue;"
        document.body.append(canvas)
        Object.defineProperties(canvas, {
            offsetWidth: { value: 160 },
            offsetHeight: { value: 90 }
        })
        const getContext = vi.spyOn(canvas, "getContext")
        const initialStyle = canvas.style.cssText
        const overlay = createImageTranslationOverlay(canvas, result)
        overlay.update({ ...result, blocks: [] })
        overlay.destroy()

        expect(getContext).not.toHaveBeenCalled()
        expect([canvas.width, canvas.height]).toEqual([320, 180])
        expect(canvas.style.cssText).toBe(initialStyle)
        expect(canvas.style.opacity).toBe("0.41")
    })

    it("projects canvas asymmetric border/padding through nonuniform viewport scale exactly", () => {
        const canvas = document.createElement("canvas")
        document.body.append(canvas)
        Object.defineProperties(canvas, {
            offsetWidth: { value: 200 },
            offsetHeight: { value: 100 }
        })
        vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
            left: 10,
            top: 20,
            right: 410,
            bottom: 320,
            width: 400,
            height: 300,
            x: 10,
            y: 20,
            toJSON: () => ({})
        })
        createImageTranslationOverlay(canvas, result, {
            getComputedStyle: () =>
                ({
                    borderLeftWidth: "5px",
                    borderTopWidth: "4px",
                    borderRightWidth: "7px",
                    borderBottomWidth: "6px",
                    paddingLeft: "10px",
                    paddingTop: "8px",
                    paddingRight: "12px",
                    paddingBottom: "14px",
                    borderRadius: "0",
                    transform: "none",
                    perspective: "none",
                    rotate: "none",
                    scale: "none",
                    translate: "none"
                }) as CSSStyleDeclaration
        })

        const root = document.querySelector<HTMLElement>(
            "[data-mewcat-image-translation-overlay]"
        )!
        const block = root.firstElementChild as HTMLElement
        expect([
            root.style.left,
            root.style.top,
            root.style.width,
            root.style.height
        ]).toEqual(["40px", "56px", "332px", "204px"])
        const geometry = [
            block.style.left,
            block.style.top,
            block.style.width,
            block.style.height
        ].map(Number.parseFloat)
        ;[66.4, 20.4, 199.2, 81.6].forEach((expected, index) => {
            expect(geometry[index]).toBeCloseTo(expected, 10)
        })
    })
})
