// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import rules from "../src/public/assets/rule.json"
import { defaultExtensionConfig } from "../src/state/constants"
import { DomSelector } from "../src/translation/DomSelector"
import { ImmersiveTranslator } from "../src/translation/ImmersiveTranslator"

const service = vi.hoisted(() => ({ translate: vi.fn() }))
vi.mock("../src/translation/translationService", () => ({
    translateBatch: service.translate,
    buildAiSummary: vi.fn(),
    hasAITranslationEnabled: () => false
}))
vi.mock("../src/utils/environment", async importOriginal => ({
    ...(await importOriginal<typeof import("../src/utils/environment")>()),
    isDevelopment: () => false
}))
let translator: ImmersiveTranslator | undefined
const config = {
    ...defaultExtensionConfig,
    cacheEnabled: false,
    maxTextLengthPerRequest: 1,
    neverTranslateLanguages: [],
    alwaysTranslateLanguages: []
}
beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML =
        '<article><p id="first">First paragraph with <a href="/first">a useful link</a>.</p><p id="second">Second paragraph remains untouched.</p></article>'
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => path } })
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ json: async () => rules }))
    )
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
        () => new DOMRect(0, 0, 500, 300)
    )
    service.translate
        .mockReset()
        .mockImplementation(
            async (_config, messages) => `译文 ${messages[0].content}`
        )
})
afterEach(() => {
    translator?.destroy()
    translator = undefined
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
describe("paragraph translation", () => {
    it("translates an inline-styled paragraph without including its siblings", async () => {
        document.querySelector<HTMLElement>("#first")!.style.display = "inline"
        translator = new ImmersiveTranslator(config)
        await translator.translateParagraph(document.querySelector("#first a")!)
        await vi.advanceTimersByTimeAsync(250)
        expect(document.querySelector("#first .mewcat-wrapper")).not.toBeNull()
        expect(document.querySelector("#second .mewcat-wrapper")).toBeNull()
        expect(service.translate).toHaveBeenCalledTimes(1)
    })
    it.each(["", "<span> </span>"])(
        "allows another shortcut to retry an empty result (%s)",
        async empty => {
            service.translate.mockResolvedValueOnce(empty)
            translator = new ImmersiveTranslator(config)
            const first = document.querySelector("#first")!
            await translator.translateParagraph(first)
            await vi.advanceTimersByTimeAsync(100)
            await translator.translateParagraph(first)
            await vi.advanceTimersByTimeAsync(200)
            expect(service.translate).toHaveBeenCalledTimes(2)
            expect(first.querySelector(".mewcat-wrapper")).not.toBeNull()
        }
    )
    it("reuses whole-page translations and preserves translation-only restoration", async () => {
        translator = new ImmersiveTranslator({
            ...config,
            translationDisplayMode: "translation"
        })
        const first = document.querySelector("#first")!
        const original = first.firstChild!
        await translator.translateParagraph(first)
        await vi.advanceTimersByTimeAsync(100)
        expect(original.parentElement?.matches("[data-mewcat-original]")).toBe(
            true
        )
        await translator.startImmersiveTranslation({ manual: true })
        await vi.advanceTimersByTimeAsync(1200)
        const count = service.translate.mock.calls.length
        await translator.translateParagraph(document.querySelector("#second")!)
        await vi.advanceTimersByTimeAsync(100)
        expect(service.translate).toHaveBeenCalledTimes(count)
        expect(translator.getTranslationScope()).toBe("page")
        translator.clearAllTranslations()
        expect(first.firstChild).toBe(original)
        expect(document.querySelector("[data-mewcat-original]")).toBeNull()
    })
    it("keeps explicit paragraph translation even when its language is excluded from automatic translation", async () => {
        translator = new ImmersiveTranslator({
            ...config,
            neverTranslateLanguages: ["en"],
            alwaysTranslateLanguages: ["fr"]
        })
        await translator.translateParagraph(document.querySelector("#first")!)
        await vi.advanceTimersByTimeAsync(200)
        expect(document.querySelector("#first .mewcat-wrapper")).not.toBeNull()
    })
    it("allows immediate retranslating of a changed paragraph before the observer refreshes", async () => {
        translator = new ImmersiveTranslator(config)
        const first = document.querySelector("#first")!
        await translator.translateParagraph(first)
        await vi.advanceTimersByTimeAsync(100)
        first.firstChild!.textContent = "Immediate replacement source text."
        await translator.translateParagraph(first)
        await vi.advanceTimersByTimeAsync(150)
        expect(first.querySelector(".mewcat-wrapper")?.textContent).toContain(
            "Immediate replacement"
        )
        expect(first.querySelectorAll(".mewcat-container")).toHaveLength(1)
    })
    it("does not revive a paragraph request cleared during initialization", async () => {
        translator = new ImmersiveTranslator(config)
        const task = translator.translateParagraph(
            document.querySelector("#first")!
        )
        translator.clearAllTranslations()
        await task
        await vi.advanceTimersByTimeAsync(100)
        expect(service.translate).not.toHaveBeenCalled()
        expect(document.querySelector(".mewcat-container")).toBeNull()
    })
    it("extracts the hovered paragraph with inline links while excluding siblings and editors", async () => {
        const selector = new DomSelector(config)
        await selector.initialize()
        const result = selector.extractParagraphTextNodes(
            document.querySelector("#first a")!
        )
        expect(result.result).toHaveLength(1)
        expect(result.result[0].container.id).toBe("first")
        expect(result.result[0].originText).toContain("useful link")
        const editor = document.createElement("div")
        editor.setAttribute("contenteditable", "true")
        editor.innerHTML = "<p>Editable paragraph must remain untouched.</p>"
        document.body.append(editor)
        expect(
            selector.extractParagraphTextNodes(editor.firstElementChild!).result
        ).toHaveLength(0)
        expect(
            selector.extractParagraphTextNodes(
                document.querySelector("article")!
            ).result
        ).toHaveLength(0)
    })
    it("keeps website selector rules confined to the requested paragraph", async () => {
        document.body.innerHTML =
            '<main><h3><a data-testid="issue-listitem-title-link"><span>First issue title needs translation</span></a></h3><h3><a data-testid="issue-listitem-title-link">Second issue title</a></h3></main>'
        const selector = new DomSelector({
            currentUrl: "https://github.com/owner/repo/issues",
            currentHostname: "github.com"
        })
        await selector.initialize()
        const result = selector.extractParagraphTextNodes(
            document.querySelector("span")!
        )
        expect(result.result).toHaveLength(1)
        expect(result.result[0].originText).toContain("First issue")
        expect(result.result[0].originText).not.toContain("Second issue")
    })
    it("translates only requested paragraphs, deduplicates triggers, and retains scope across changes", async () => {
        translator = new ImmersiveTranslator(config)
        const first = document.querySelector<HTMLElement>("#first")!
        await Promise.all([
            translator.translateParagraph(first),
            translator.translateParagraph(first)
        ])
        await vi.advanceTimersByTimeAsync(150)
        expect(service.translate).toHaveBeenCalledTimes(1)
        expect(first.querySelector(".mewcat-wrapper")).not.toBeNull()
        expect(document.querySelector("#second .mewcat-wrapper")).toBeNull()
        document
            .querySelector("article")!
            .insertAdjacentHTML(
                "beforeend",
                "<p>New unrelated content must remain untranslated.</p>"
            )
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate).toHaveBeenCalledTimes(1)
        await translator.updateConfig({ ...config, targetLanguage: "ja" })
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate).toHaveBeenCalledTimes(2)
        expect(service.translate.mock.calls.at(-1)![2]).toBe("ja")
        expect(document.querySelectorAll(".mewcat-wrapper")).toHaveLength(1)
        first.firstChild!.textContent =
            "The selected paragraph now has updated text."
        await vi.advanceTimersByTimeAsync(1200)
        expect(service.translate).toHaveBeenCalledTimes(3)
        expect(document.querySelectorAll(".mewcat-wrapper")).toHaveLength(1)
        translator.clearAllTranslations()
        expect(document.querySelector(".mewcat-container")).toBeNull()
    })
    it("preserves each paragraph's links when responses arrive in reverse order", async () => {
        document.querySelector("#second")!.innerHTML =
            'Second paragraph with <a href="/second">another useful link</a>.'
        const pending: Array<() => void> = []
        service.translate.mockImplementation(
            (_config, messages) =>
                new Promise(resolve =>
                    pending.push(() => resolve(`译文 ${messages[0].content}`))
                )
        )
        translator = new ImmersiveTranslator(config)
        const a = translator.translateParagraph(
            document.querySelector("#first")!
        )
        const b = translator.translateParagraph(
            document.querySelector("#second")!
        )
        await vi.advanceTimersByTimeAsync(100)
        pending[1]()
        pending[0]()
        await Promise.all([a, b])
        await vi.advanceTimersByTimeAsync(100)
        expect(
            document
                .querySelector("#first .mewcat-wrapper a")
                ?.getAttribute("href")
        ).toBe("/first")
        expect(
            document
                .querySelector("#second .mewcat-wrapper a")
                ?.getAttribute("href")
        ).toBe("/second")
    })
})
