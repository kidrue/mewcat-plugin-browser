// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import rules from "../src/public/assets/rule.json"
import { defaultExtensionConfig } from "../src/state/constants"
import { DomSelector } from "../src/translation/DomSelector"
import { ImmersiveTranslator } from "../src/translation/ImmersiveTranslator"

vi.mock("../src/utils/environment", async importOriginal => ({
    ...(await importOriginal<typeof import("../src/utils/environment")>()),
    isDevelopment: () => false
}))
vi.mock("../src/translation/translationService", () => ({
    translateBatch: async (_config: unknown, messages: { content: string }[]) =>
        messages[0].content
            .replaceAll("Alpha", "甲译文")
            .replaceAll("Beta", "乙译文")
            .replaceAll("Gamma", "丙译文"),
    buildAiSummary: vi.fn(),
    hasAITranslationEnabled: () => false
}))

const config = {
    ...defaultExtensionConfig,
    cacheEnabled: false,
    neverTranslateLanguages: [],
    alwaysTranslateLanguages: []
}
let translator: ImmersiveTranslator | undefined

beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => path } })
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ json: async () => rules }))
    )
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
        () => new DOMRect(0, 0, 500, 300)
    )
})

afterEach(() => {
    translator?.destroy()
    translator = undefined
    document.body.innerHTML = ""
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

async function createSelector() {
    const selector = new DomSelector({
        currentUrl:
            "https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions#claim-in-chatgpt",
        currentHostname: "help.openai.com",
        targetLanguage: "zh-CN"
    })
    await selector.initialize()
    return selector
}

function mount(html: string) {
    document.body.innerHTML = `<article><p>${html}</p></article>`
    return document.querySelector("p")!
}

function translations(root: Element = document.body) {
    return [...root.querySelectorAll(".mewcat-wrapper")].map(
        node => node.textContent
    )
}

async function translate(root: Element) {
    translator = new ImmersiveTranslator(config)
    await translator.translateParagraph(root)
    await vi.advanceTimersByTimeAsync(200)
}

describe("BR translation segments", () => {
    it.each([
        ["Alpha<br>Beta", ["Alpha", "Beta"]],
        ["Alpha<br style='display:inline'>Beta", ["Alpha", "Beta"]],
        ["Alpha<br>Beta<br>Gamma", ["Alpha", "Beta", "Gamma"]],
        ["<br>Alpha<br><br> \n <br>Beta<br><br>", ["Alpha", "Beta"]],
        [
            "Alpha<br>Alpha<br>Alpha extended",
            ["Alpha", "Alpha", "Alpha extended"]
        ]
    ])(
        "extracts independent nonempty segments from %s",
        async (html, expected) => {
            mount(html as string)
            const selector = await createSelector()
            const { result } = selector.extractTargetTextNodes(
                document.body,
                true
            )
            expect(result.map(node => node.originText)).toEqual(expected)
            expect(new Set(result.map(node => node.id)).size).toBe(
                result.length
            )
            expect(result.every(node => node.insertTagType === "br")).toBe(true)
            expect(
                selector
                    .extractTargetTextNodes(document.body, true)
                    .result.map(node => node.id)
            ).toEqual(result.map(node => node.id))
        }
    )

    it("ignores hidden and excluded breaks while retaining visible boundaries", async () => {
        mount(
            "Alpha<br hidden> Beta<br style='display:none'> Gamma<br><code>x<br>y</code>Alpha"
        )
        const selector = await createSelector()
        const { result } = selector.extractTargetTextNodes(document.body, true)
        expect(result).toHaveLength(2)
        expect(result[0].originText).toContain("Gamma")
        expect(result[1].originText).toMatch(/Alpha$/)
        expect(result[1].originText).not.toContain("xy")
    })

    it("does not split a paragraph containing only excluded breaks", async () => {
        mount("Alpha <code>x<br>y</code> Beta")
        const selector = await createSelector()
        expect(
            selector.extractTargetTextNodes(document.body, true).result
        ).toHaveLength(1)
    })

    it("does not request translation for lines containing only preserved content", async () => {
        mount('<span><code>x</code><br><img src="/icon.png"><br>Alpha</span>')
        const selector = await createSelector()
        expect(
            selector
                .extractTargetTextNodes(document.body, true)
                .result.map(node => node.originText)
        ).toEqual(["Alpha"])
    })

    it("keeps nested link text confined to its own segment", async () => {
        mount('<strong>Alpha <a href="/help">Alpha<br>Beta</a> Gamma</strong>')
        const selector = await createSelector()
        const { result, stayOriginalMap } = selector.extractTargetTextNodes(
            document.body,
            true
        )
        expect(result).toHaveLength(2)
        expect(result[0].originText).toContain("Alpha")
        expect(result[0].originText).not.toContain("Beta")
        expect(result[1].originText).toContain("Beta")
        expect(result[1].originText).not.toContain("Alpha")
        expect(result.every(node => /<a\d+>/.test(node.originText!))).toBe(true)
        expect(
            Object.values(stayOriginalMap)
                .filter(node => node.tagName === "A")
                .map(node => node.getAttribute("href"))
        ).toEqual(["/help", "/help"])
    })

    it("inserts each short translation after its line break and before the next original", async () => {
        const root = mount("Alpha<br>Beta<br>Gamma")
        const [firstBreak, secondBreak] = root.querySelectorAll("br")
        await translate(root)
        expect(translations(root)).toEqual(["甲译文", "乙译文", "丙译文"])
        expect(firstBreak.nextSibling).toBe(
            root.querySelectorAll(".mewcat-container")[0]
        )
        expect(secondBreak.nextSibling).toBe(
            root.querySelectorAll(".mewcat-container")[1]
        )
        expect(
            [...root.querySelectorAll<HTMLElement>(".mewcat-container")].every(
                node => node.style.display === "block"
            )
        ).toBe(true)
        expect(root.textContent).toBe("Alpha甲译文Beta乙译文Gamma丙译文")
    })

    it("keeps repeated lines visible after translation and repeated triggers", async () => {
        const root = mount("Alpha<br>Alpha<br>Alpha extended")
        await translate(root)
        await translator!.translateParagraph(root)
        await vi.advanceTimersByTimeAsync(200)
        expect(translations(root)).toEqual([
            "甲译文",
            "甲译文",
            "甲译文 extended"
        ])
        expect(root.querySelectorAll(".mewcat-container")).toHaveLength(3)
    })

    it("preserves original links and restores all original nodes after display changes", async () => {
        const root = mount(
            '<strong>Alpha <a href="/help">Alpha<br>Beta</a> Gamma</strong><br>Beta'
        )
        const originalHtml = root.innerHTML
        const link = root.querySelector("a")!
        const clicked = vi.fn((event: Event) => event.preventDefault())
        link.addEventListener("click", clicked)
        await translate(root)
        expect(translations(root)).toHaveLength(3)
        await translator!.updateConfig({
            ...config,
            translationDisplayMode: "translation"
        })
        await vi.advanceTimersByTimeAsync(200)
        expect(
            root.querySelectorAll("[data-mewcat-original]").length
        ).toBeGreaterThan(0)
        expect(translations(root)).toHaveLength(3)
        expect(
            [...root.querySelectorAll(".mewcat-wrapper")].every(
                node => !node.closest("[data-mewcat-original]")
            )
        ).toBe(true)
        await translator!.updateConfig({
            ...config,
            translationDisplayMode: "bilingual"
        })
        translator!.clearAllTranslations()
        expect(root.innerHTML).toBe(originalHtml)
        expect(root.querySelector("a")).toBe(link)
        link.click()
        expect(clicked).toHaveBeenCalledOnce()
    })

    it("refreshes edited and removed lines without leaving stale translations", async () => {
        const root = mount("Alpha<br>Beta")
        const first = root.firstChild!
        const br = root.querySelector("br")!
        await translate(root)
        first.textContent = "Gamma"
        await vi.advanceTimersByTimeAsync(1500)
        expect(translations(root)).toEqual(["丙译文", "乙译文"])
        br.remove()
        await vi.advanceTimersByTimeAsync(1500)
        expect(translations(root)).toEqual(["丙译文乙译文"])
        expect(root.querySelectorAll(".mewcat-container")).toHaveLength(1)
    })

    it("splits an already translated paragraph when a break is added", async () => {
        const root = mount("Alpha Beta")
        const original = root.firstChild as Text
        await translate(root)
        const second = original.splitText(6)
        root.insertBefore(document.createElement("br"), second)
        await vi.advanceTimersByTimeAsync(1500)
        expect(translations(root)).toEqual(["甲译文", "乙译文"])
        expect(root.querySelectorAll(".mewcat-container")).toHaveLength(2)
    })

    it("does not translate old results when the last break inside a link is removed", async () => {
        const root = mount('<a href="/help">Alpha<br>Beta</a>')
        const br = root.querySelector("br")!
        await translate(root)
        br.remove()
        await vi.advanceTimersByTimeAsync(1500)
        expect(translations(root)).toEqual(["甲译文乙译文"])
        expect(root.querySelectorAll(".mewcat-container")).toHaveLength(1)
        translator!.clearAllTranslations()
        expect(root.innerHTML).toBe('<a href="/help">AlphaBeta</a>')
    })

    it("refreshes nested segments while originals are hidden", async () => {
        const root = mount('<a href="/help">Alpha<br>Beta</a>')
        const first = root.querySelector("a")!.firstChild!
        await translate(root)
        await translator!.updateConfig({
            ...config,
            translationDisplayMode: "translation"
        })
        first.textContent = "Gamma"
        await vi.advanceTimersByTimeAsync(1500)
        expect(translations(root)).toEqual(["丙译文", "乙译文"])
        expect(
            [...root.querySelectorAll(".mewcat-wrapper")].every(
                node => !node.closest("[data-mewcat-original]")
            )
        ).toBe(true)
        translator!.clearAllTranslations()
        expect(root.innerHTML).toBe('<a href="/help">Gamma<br>Beta</a>')
    })
})
