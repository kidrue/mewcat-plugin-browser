// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import rules from "../src/public/assets/rule.json"
import { defaultExtensionConfig } from "../src/state/constants"
import { DomSelector } from "../src/translation/DomSelector"
import {
    InsertPosition,
    type TranslationNode
} from "../src/translation/DOMTraverser"
import { ImmersiveTranslator } from "../src/translation/ImmersiveTranslator"

const service = vi.hoisted(() => ({
    translate: vi.fn(),
    summary: vi.fn(),
    abort: vi.fn()
}))
vi.mock("../src/translation/translationService", () => ({
    translateBatch: service.translate,
    buildAiSummary: service.summary,
    abortAllTranslations: service.abort,
    hasAITranslationEnabled: () => true
}))
vi.mock("../src/utils/environment", async importOriginal => ({
    ...(await importOriginal<typeof import("../src/utils/environment")>()),
    isDevelopment: () => false
}))

let translator: ImmersiveTranslator
let nodes: TranslationNode[]
const config = {
    ...defaultExtensionConfig,
    cacheEnabled: false,
    enableViewportTranslation: true,
    maxTextLengthPerRequest: 1,
    maxRequestsPerSecond: 3
}
function makeNode(id: string, top: number) {
    const container = document.createElement("p")
    container.textContent = id
    document.body.append(container)
    container.getBoundingClientRect = () =>
        new DOMRect(0, top - window.scrollY, 200, 30)
    const node: TranslationNode = {
        id,
        container,
        originText: id,
        textNodes: [
            {
                element: container.firstChild as HTMLElement,
                content: id,
                type: "text"
            }
        ],
        insertPosition: InsertPosition.AFTER,
        insertTagType: "br"
    }
    nodes.push(node)
    return node
}
beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ""
    nodes = []
    Object.defineProperties(window, {
        innerHeight: { configurable: true, value: 500 },
        scrollY: { configurable: true, value: 0 }
    })
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible"
    })
    vi.spyOn(DomSelector.prototype, "initialize").mockResolvedValue(undefined)
    vi.spyOn(
        DomSelector.prototype,
        "extractTargetTextNodes"
    ).mockImplementation(() => ({
        result: [...nodes],
        stayOriginalMap: {},
        visibleNodes: nodes.slice(0, 1),
        nonVisibleNodes: nodes.slice(1)
    }))
    service.translate
        .mockReset()
        .mockImplementation(
            async (_config, messages) => `译文 ${messages[0].content}`
        )
    service.summary.mockReset().mockResolvedValue("全文摘要")
    service.abort.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
    translator?.destroy()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
const requested = () =>
    service.translate.mock.calls.map(call => call[1][0].content)

describe("viewport translation integration", () => {
    it("keeps real DOM extraction stable after translation markup and later mutations", async () => {
        vi.mocked(DomSelector.prototype.initialize).mockRestore()
        vi.mocked(DomSelector.prototype.extractTargetTextNodes).mockRestore()
        vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => path } })
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ json: async () => rules }))
        )
        vi.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(() => new DOMRect(0, 0, 500, 300))
        makeNode("This is the visible paragraph for reading.", 0)
        makeNode("This distant paragraph should wait for the reader.", 4000)
        translator = new ImmersiveTranslator({
            ...config,
            neverTranslateLanguages: [],
            alwaysTranslateLanguages: []
        })
        await vi.advanceTimersByTimeAsync(20)
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(100)
        makeNode("Another distant paragraph is inserted dynamically.", 5000)
        await vi.advanceTimersByTimeAsync(200)
        expect(requested()).toEqual([
            "This is the visible paragraph for reading."
        ])
        expect(document.body.textContent).toContain(
            "译文 This is the visible paragraph for reading."
        )
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 4000
        })
        document.dispatchEvent(new Event("scroll"))
        await vi.advanceTimersByTimeAsync(300)
        expect(requested()).toEqual([
            "This is the visible paragraph for reading.",
            "This distant paragraph should wait for the reader."
        ])
    })
    it("refreshes source text references when a framework replaces identical text nodes", async () => {
        const item = makeNode("same-text", 4000)
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(100)
        item.container.textContent = "same-text"
        nodes = [
            {
                ...item,
                textNodes: [
                    {
                        ...item.textNodes![0],
                        element: item.container.firstChild as HTMLElement
                    }
                ]
            }
        ]
        await vi.advanceTimersByTimeAsync(100)
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 4000
        })
        document.dispatchEvent(new Event("scroll"))
        await vi.advanceTimersByTimeAsync(300)
        expect(requested()).toEqual(["same-text"])
        expect(document.body.textContent).toContain("译文 same-text")
    })

    it("restores an already completed translation after identical source DOM is rebuilt without another request", async () => {
        const item = makeNode("same-text", 0)
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(100)
        item.container.textContent = "same-text"
        nodes = [
            {
                ...item,
                textNodes: [
                    {
                        ...item.textNodes![0],
                        element: item.container.firstChild as HTMLElement
                    }
                ]
            }
        ]
        await vi.advanceTimersByTimeAsync(200)
        expect(requested()).toEqual(["same-text"])
        expect(document.body.textContent).toContain("译文 same-text")
    })

    it("removes queued source text which no longer exists even if its container stays connected", async () => {
        const item = makeNode("removed-text", 4000)
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(100)
        item.container.textContent = ""
        nodes = []
        await vi.advanceTimersByTimeAsync(100)
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 4000
        })
        document.dispatchEvent(new Event("scroll"))
        await vi.advanceTimersByTimeAsync(300)
        expect(requested()).toEqual([])
    })
    it("starts a persistent reading session without translating far content or generating a full-page summary", async () => {
        makeNode("near", 10)
        makeNode("far", 4000)
        translator = new ImmersiveTranslator({ ...config, enableContext: true })
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(100)
        expect(requested()).toEqual(["near"])
        expect(service.summary).not.toHaveBeenCalled()
        expect(document.body.textContent).toContain("译文 near")
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 4000
        })
        document.dispatchEvent(new Event("scroll"))
        await vi.advanceTimersByTimeAsync(199)
        expect(requested()).toEqual(["near"])
        await vi.advanceTimersByTimeAsync(100)
        expect(requested()).toEqual(["near", "far"])
        expect(document.body.textContent).toContain("译文 far")
    })

    it("keeps whole-page translation when the flag is absent", async () => {
        makeNode("near", 0)
        makeNode("far", 4000)
        translator = new ImmersiveTranslator({
            ...config,
            enableViewportTranslation: undefined
        })
        await translator.startImmersiveTranslation()
        expect(requested()).toEqual(["near", "far"])
    })

    it("routes dynamically inserted far nodes through the same range restriction", async () => {
        makeNode("near", 0)
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(100)
        makeNode("added-far", 4000)
        await vi.advanceTimersByTimeAsync(300)
        expect(requested()).toEqual(["near"])
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 4000
        })
        document.dispatchEvent(new Event("scroll"))
        await vi.advanceTimersByTimeAsync(300)
        expect(requested()).toEqual(["near", "added-far"])
    })

    it("disabling the flag fills the rest of the page without retranslating completed content", async () => {
        makeNode("near", 0)
        makeNode("far", 4000)
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(100)
        await translator.updateConfig({
            ...config,
            enableViewportTranslation: false
        })
        await vi.advanceTimersByTimeAsync(100)
        expect(requested()).toEqual(["near", "far"])
    })

    it("enabling the flag stops the old full-page queue and retains its in-flight result", async () => {
        let resolve!: (text: string) => void
        service.translate.mockImplementationOnce(
            () =>
                new Promise(done => {
                    resolve = done
                })
        )
        makeNode("near", 0)
        makeNode("far", 4000)
        translator = new ImmersiveTranslator({
            ...config,
            enableViewportTranslation: false,
            maxRequestsPerSecond: 1
        })
        const start = translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(20)
        await translator.updateConfig({ ...config, maxRequestsPerSecond: 1 })
        resolve("译文 near")
        await start
        await vi.advanceTimersByTimeAsync(1200)
        expect(requested()).toEqual(["near"])
        expect(document.body.textContent).toContain("译文 near")
    })

    it("does not render an old response after a session is cleared and restarted", async () => {
        let resolve!: (text: string) => void
        service.translate.mockImplementationOnce(
            () =>
                new Promise(done => {
                    resolve = done
                })
        )
        makeNode("near", 0)
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(20)
        translator.clearAllTranslations()
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(50)
        resolve("过期结果")
        await vi.advanceTimersByTimeAsync(100)
        expect(document.body.textContent).not.toContain("过期结果")
        expect(document.body.textContent).toContain("译文 near")
    })

    it("translates replacement text in a reused element without retaining its previous translation", async () => {
        const item = makeNode("reused", 0)
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(100)
        item.container.firstChild!.textContent = "replacement"
        nodes = [
            {
                ...item,
                originText: "replacement",
                textNodes: [{ ...item.textNodes![0], content: "replacement" }]
            }
        ]
        await vi.advanceTimersByTimeAsync(1200)
        expect(requested()).toEqual(["reused", "replacement"])
        expect(document.body.textContent).not.toContain("译文 reused")
        expect(document.body.textContent).toContain("译文 replacement")
    })

    it("uses a changed target language for later reading tasks and discards the previous session", async () => {
        makeNode("near", 0)
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation()
        await vi.advanceTimersByTimeAsync(100)
        await translator.updateConfig({ ...config, targetLanguage: "ja" })
        await vi.advanceTimersByTimeAsync(100)
        expect(service.translate.mock.calls.at(-1)![2]).toBe("ja")
    })
})
