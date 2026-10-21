// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    InsertPosition,
    type TranslationNode
} from "../src/translation/DOMTraverser"
import { ViewportTranslationScheduler } from "../src/translation/ViewportTranslationScheduler"

const schedulers: ViewportTranslationScheduler[] = []
function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(done => {
        resolve = done
    })
    return { promise, resolve }
}
function node(
    id: string,
    top: number,
    parent = document.body
): TranslationNode {
    const container = document.createElement("p")
    container.textContent = id
    parent.append(container)
    container.getBoundingClientRect = () =>
        new DOMRect(0, top - window.scrollY, 200, 30)
    return {
        id,
        container,
        originText: id,
        insertPosition: InsertPosition.AFTER
    }
}
function setup(
    overrides: Partial<
        ConstructorParameters<typeof ViewportTranslationScheduler>[0]
    > = {}
) {
    const sent: string[][] = []
    const rendered: string[] = []
    const scheduler = new ViewportTranslationScheduler({
        viewportOnly: true,
        getLimits: () => ({
            maxRequestsPerSecond: 3,
            maxTextLengthPerRequest: 1
        }),
        readCache: async () => null,
        writeCache: async () => {},
        translate: async nodes => {
            sent.push(nodes.map(item => item.id))
            return nodes.map(item => `译文:${item.id}`)
        },
        render: results => {
            rendered.push(...results.map(item => item.node.id))
        },
        onError: () => {},
        ...overrides
    })
    schedulers.push(scheduler)
    return { scheduler, sent, rendered }
}
async function scroll(y: number, delay = 20) {
    await vi.advanceTimersByTimeAsync(delay)
    Object.defineProperty(window, "scrollY", { configurable: true, value: y })
    document.dispatchEvent(new Event("scroll"))
}
beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ""
    Object.defineProperties(window, {
        innerHeight: { configurable: true, value: 500 },
        innerWidth: { configurable: true, value: 800 },
        scrollY: { configurable: true, value: 0 }
    })
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible"
    })
})
afterEach(() => {
    schedulers.splice(0).forEach(scheduler => scheduler.destroy())
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("reading range scheduler", () => {
    it("does not revisit distant elements on every scroll when observer candidates are available", async () => {
        vi.stubGlobal(
            "IntersectionObserver",
            class {
                observe = vi.fn()
                unobserve = vi.fn()
                disconnect = vi.fn()
            }
        )
        const near = node("near", 0)
        const far = node("far", 4000)
        const { scheduler } = setup()
        scheduler.add([near, far])
        await vi.advanceTimersByTimeAsync(100)
        const connected = vi.spyOn(far.container, "isConnected", "get")
        await scroll(5, 100)
        await vi.advanceTimersByTimeAsync(100)
        expect(connected).not.toHaveBeenCalled()
    })

    it("rechecks earlier batch results after another cache write waits", async () => {
        const cacheWrite = deferred<void>()
        const first = node("first", 0)
        const second = node("second", 100)
        const { scheduler, rendered } = setup({
            getLimits: () => ({
                maxRequestsPerSecond: 1,
                maxTextLengthPerRequest: 1024
            }),
            writeCache: async item => {
                if (item.id === "second") await cacheWrite.promise
            }
        })
        scheduler.add([first, second])
        await vi.advanceTimersByTimeAsync(100)
        first.container.remove()
        cacheWrite.resolve()
        await vi.advanceTimersByTimeAsync(100)
        expect(rendered).toEqual(["second"])
    })
    it("updates the prefetch observer when an inner scroll container changes height", async () => {
        const observerOptions: IntersectionObserverInit[] = []
        let resized!: ResizeObserverCallback
        const resizeDisconnect = vi.fn()
        vi.stubGlobal(
            "ResizeObserver",
            class {
                constructor(callback: ResizeObserverCallback) {
                    resized = callback
                }
                observe = vi.fn()
                unobserve = vi.fn()
                disconnect = resizeDisconnect
            }
        )
        vi.stubGlobal(
            "IntersectionObserver",
            class {
                constructor(
                    _callback: IntersectionObserverCallback,
                    options: IntersectionObserverInit
                ) {
                    observerOptions.push(options)
                }
                observe = vi.fn()
                unobserve = vi.fn()
                disconnect = vi.fn()
            }
        )
        const panel = document.createElement("div")
        panel.style.overflowY = "auto"
        document.body.append(panel)
        let height = 100
        panel.getBoundingClientRect = () => new DOMRect(0, 100, 300, height)
        Object.defineProperties(panel, {
            clientHeight: { get: () => height },
            clientWidth: { value: 300 },
            scrollHeight: { value: 1500 }
        })
        const { scheduler, sent } = setup()
        scheduler.add([node("next", 450, panel)])
        await vi.advanceTimersByTimeAsync(50)
        expect(sent).toEqual([])
        height = 200
        resized?.(
            [{ target: panel } as ResizeObserverEntry],
            {} as ResizeObserver
        )
        // Rebuilding during delivery can trigger a browser observer loop.
        expect(resizeDisconnect).not.toHaveBeenCalled()
        expect(observerOptions.at(-1)?.rootMargin).toBe("100px 0px")
        await vi.advanceTimersByTimeAsync(50)
        expect(sent).toEqual([["next"]])
        expect(observerOptions.at(-1)?.rootMargin).toBe("200px 0px")
        scheduler.destroy()
        expect(resizeDisconnect).toHaveBeenCalled()
    })
    it("continues translating during slow reading and enforces the request rate", async () => {
        const { scheduler, sent } = setup({
            getLimits: () => ({
                maxRequestsPerSecond: 1,
                maxTextLengthPerRequest: 1
            })
        })
        scheduler.add([
            node("first", 0),
            node("second", 100),
            node("third", 200)
        ])
        await vi.advanceTimersByTimeAsync(100)
        for (let index = 1; index <= 10; index++) await scroll(index * 5, 100)
        expect(sent).toEqual([["first"], ["second"]])
        await vi.advanceTimersByTimeAsync(1000)
        expect(sent).toEqual([["first"], ["second"], ["third"]])
    })

    it("does not translate content clipped by a non-scrolling ancestor", async () => {
        const panel = document.createElement("div")
        panel.style.overflow = "hidden"
        document.body.append(panel)
        panel.getBoundingClientRect = () => new DOMRect(0, 100, 300, 100)
        Object.defineProperties(panel, {
            clientHeight: { value: 100 },
            clientWidth: { value: 300 }
        })
        const { scheduler, sent } = setup()
        scheduler.add([node("hidden", 300, panel), node("visible", 110, panel)])
        await vi.advanceTimersByTimeAsync(100)
        expect(sent).toEqual([["visible"]])
    })

    it("waits when the tab is hidden and resumes when it is shown", async () => {
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "hidden"
        })
        const { scheduler, sent } = setup()
        scheduler.add([node("near", 0)])
        await vi.advanceTimersByTimeAsync(100)
        expect(sent).toEqual([])
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible"
        })
        document.dispatchEvent(new Event("visibilitychange"))
        await vi.advanceTimersByTimeAsync(100)
        expect(sent).toEqual([["near"]])
    })
    it("sends only intersecting three-screen blocks with visible DOM order first", async () => {
        const before = node("before", -510)
        const first = node("first", 400)
        const second = node("second", 10)
        const after = node("after", 999)
        const outside = node("outside", 1000)
        const { scheduler, sent } = setup()
        scheduler.add([outside, after, second, first, before])
        await vi.advanceTimersByTimeAsync(2100)
        expect(sent).toEqual([["first"], ["second"], ["before"], ["after"]])
    })

    it("pauses a fast jump and starts at the new visible content after settling", async () => {
        const cached = deferred<string | null>()
        const { scheduler, sent } = setup({ readCache: () => cached.promise })
        scheduler.add([
            node("old", 20),
            node("new", 2520),
            node("skipped", 1500)
        ])
        await vi.advanceTimersByTimeAsync(20)
        await scroll(2500)
        cached.resolve(null)
        await vi.advanceTimersByTimeAsync(199)
        expect(sent).toEqual([])
        await vi.advanceTimersByTimeAsync(50)
        expect(sent).toEqual([["new"]])
    })

    it("reprioritizes pending nodes when the reader reverses direction", async () => {
        const request = deferred<string[]>()
        const sent: string[][] = []
        const { scheduler } = setup({
            getLimits: () => ({
                maxRequestsPerSecond: 1,
                maxTextLengthPerRequest: 1
            }),
            translate: nodes => {
                sent.push(nodes.map(item => item.id))
                return sent.length === 1
                    ? request.promise
                    : Promise.resolve(["译文"])
            }
        })
        scheduler.add([
            node("first", 10),
            node("above", 350),
            node("visible", 650),
            node("below", 1050)
        ])
        await vi.advanceTimersByTimeAsync(30)
        await scroll(700)
        await scroll(500)
        await vi.advanceTimersByTimeAsync(220)
        request.resolve(["译文"])
        await vi.advanceTimersByTimeAsync(3200)
        expect(sent).toEqual([["first"], ["visible"], ["above"], ["below"]])
    })

    it("uses cached content without a request and deduplicates additions", async () => {
        const item = node("cached", 10)
        const { scheduler, sent, rendered } = setup({
            readCache: async () => "缓存译文"
        })
        scheduler.add([item, item])
        await vi.advanceTimersByTimeAsync(50)
        scheduler.add([item])
        await scroll(5, 500)
        await vi.advanceTimersByTimeAsync(300)
        expect(sent).toEqual([])
        expect(rendered).toEqual(["cached"])
    })

    it("does not automatically retry failures on scroll, but allows an explicit retry", async () => {
        const translate = vi
            .fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValue(["成功"])
        const item = node("retry", 10)
        const { scheduler, rendered } = setup({ translate })
        scheduler.add([item])
        await vi.advanceTimersByTimeAsync(50)
        await scroll(5, 500)
        await vi.advanceTimersByTimeAsync(1100)
        expect(translate).toHaveBeenCalledTimes(1)
        scheduler.add([item], true)
        await vi.advanceTimersByTimeAsync(100)
        expect(translate).toHaveBeenCalledTimes(2)
        expect(rendered).toEqual(["retry"])
    })

    it("keeps in-flight results when toggled and translates remaining content when disabled", async () => {
        const request = deferred<string[]>()
        const sent: string[][] = []
        const { scheduler, rendered } = setup({
            translate: nodes => {
                sent.push(nodes.map(item => item.id))
                return sent.length === 1
                    ? request.promise
                    : Promise.resolve(["远处译文"])
            }
        })
        scheduler.add([node("near", 0), node("far", 4000)])
        await vi.advanceTimersByTimeAsync(50)
        scheduler.setViewportOnly(false)
        request.resolve(["当前译文"])
        await vi.advanceTimersByTimeAsync(100)
        expect(sent).toEqual([["near"], ["far"]])
        expect(rendered.sort()).toEqual(["far", "near"])
    })

    it("ignores a detached or replaced node and all results after destroy", async () => {
        const request = deferred<string[]>()
        const writeCache = vi.fn()
        const { scheduler, rendered } = setup({
            translate: () => request.promise,
            writeCache
        })
        scheduler.add([node("old", 0)])
        await vi.advanceTimersByTimeAsync(50)
        scheduler.destroy()
        request.resolve(["过期译文"])
        await vi.advanceTimersByTimeAsync(1500)
        expect(rendered).toEqual([])
        expect(writeCache).not.toHaveBeenCalled()
    })

    it("uses the nested scrollport height and catches non-bubbling inner scrolls", async () => {
        const panel = document.createElement("div")
        panel.style.overflowY = "auto"
        document.body.append(panel)
        panel.getBoundingClientRect = () => new DOMRect(0, 100, 300, 100)
        Object.defineProperties(panel, {
            clientHeight: { value: 100 },
            clientWidth: { value: 300 },
            scrollHeight: { value: 1500 }
        })
        const near = node("inner-near", 0, panel)
        const far = node("inner-far", 0, panel)
        near.container.getBoundingClientRect = () =>
            new DOMRect(0, 110 - panel.scrollTop, 200, 20)
        far.container.getBoundingClientRect = () =>
            new DOMRect(0, 400 - panel.scrollTop, 200, 20)
        const { scheduler, sent } = setup()
        scheduler.add([near, far])
        await vi.advanceTimersByTimeAsync(50)
        expect(sent).toEqual([["inner-near"]])
        panel.scrollTop = 300
        panel.dispatchEvent(new Event("scroll"))
        await vi.advanceTimersByTimeAsync(199)
        expect(sent).toHaveLength(1)
        await vi.advanceTimersByTimeAsync(50)
        expect(sent).toEqual([["inner-near"], ["inner-far"]])
    })

    it("uses observer candidates but rechecks stale intersections before sending", async () => {
        let callback!: IntersectionObserverCallback
        const observe = vi.fn()
        const disconnect = vi.fn()
        vi.stubGlobal(
            "IntersectionObserver",
            class {
                constructor(cb: IntersectionObserverCallback) {
                    callback = cb
                }
                observe = observe
                unobserve = vi.fn()
                disconnect = disconnect
            }
        )
        const { scheduler, sent } = setup()
        const far = node("far", 2000)
        scheduler.add([far])
        callback(
            [
                {
                    target: far.container,
                    isIntersecting: true
                } as IntersectionObserverEntry
            ],
            {} as IntersectionObserver
        )
        await vi.advanceTimersByTimeAsync(100)
        expect(observe).toHaveBeenCalledWith(far.container)
        expect(sent).toEqual([])
        scheduler.destroy()
        expect(disconnect).toHaveBeenCalled()
    })
})
