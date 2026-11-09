// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import rules from "../src/public/assets/rule.json"
import { defaultExtensionConfig } from "../src/state/constants"
import { DomSelector } from "../src/translation/DomSelector"
import { ImmersiveTranslator } from "../src/translation/ImmersiveTranslator"
import { AiRole } from "../src/types/config"

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
    document.title = ""
    translator = undefined
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
describe("paragraph translation", () => {
    it("retains manually included inline text when page rules still exclude it", async () => {
        document.body.innerHTML =
            '<main><p id="included">Regular text <span class="notranslate">Manually included content</span></p></main>'
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation({ manual: true })
        await vi.advanceTimersByTimeAsync(300)
        const root = document.querySelector("#included")!
        expect(
            root.querySelector(".mewcat-wrapper")?.textContent
        ).not.toContain("Manually included")
        await translator.translateParagraph(root)
        await vi.advanceTimersByTimeAsync(300)
        expect(root.querySelector(".mewcat-wrapper")?.textContent).toContain(
            "Manually included"
        )
        document
            .querySelector("main")!
            .append(document.createElement("section"))
        await vi.advanceTimersByTimeAsync(500)
        expect(root.querySelector(".mewcat-wrapper")?.textContent).toContain(
            "Manually included"
        )
        await translator.startImmersiveTranslation({ manual: true })
        await vi.advanceTimersByTimeAsync(500)
        expect(root.querySelector(".mewcat-wrapper")?.textContent).toContain(
            "Manually included"
        )
        expect(root.querySelectorAll(".mewcat-container")).toHaveLength(1)
    })
    it("refreshes preserved code clones after source code content changes", async () => {
        document.body.innerHTML =
            "<article><p>Run <code>old command</code> to continue.</p></article>"
        const code = document.querySelector("code")!
        translator = new ImmersiveTranslator(config)
        await translator.translateParagraph(document.querySelector("p")!)
        await vi.advanceTimersByTimeAsync(200)
        expect(
            document.querySelector(".mewcat-wrapper code")?.textContent
        ).toBe("old command")
        code.textContent = "new command"
        await vi.advanceTimersByTimeAsync(500)
        expect(
            document.querySelector(".mewcat-wrapper code")?.textContent
        ).toBe("new command")
    })
    it("preserves block-level code descendants instead of extracting their text", async () => {
        document.body.innerHTML =
            '<article><div id="root">Normal paragraph text<div role="code">secret_code_content</div><pre>another_secret</pre>Paragraph ending.</div></article>'
        const selector = new DomSelector(config)
        await selector.initialize()
        const extracted = selector.extractParagraphTextNodes(
            document.querySelector("#root")!
        )
        const text = extracted.result.map(node => node.originText).join(" ")
        expect(text).toContain("Normal paragraph text")
        expect(text).toContain("Paragraph ending.")
        expect(text).not.toContain("secret_code_content")
        expect(text).not.toContain("another_secret")
    })
    it("retains source identity for whole-page visible-priority batches", async () => {
        document.body.innerHTML = `<article>${Array.from({ length: 22 }, (_, index) => `<p>Article paragraph number ${index} needs translation.</p>`).join("")}</article>`
        translator = new ImmersiveTranslator({
            ...config,
            prioritizeVisibleArea: true,
            enableViewportTranslation: false
        })
        const task = translator.startImmersiveTranslation({ manual: true })
        await vi.advanceTimersByTimeAsync(15000)
        await task
        expect(document.querySelectorAll(".mewcat-wrapper")).toHaveLength(22)
    })
    it("excludes hidden descendants when serializing inline links", async () => {
        document.body.innerHTML =
            '<article><p>Visible <a href="/help">link <span hidden>hidden_secret</span></a> text.</p></article>'
        const selector = new DomSelector(config)
        await selector.initialize()
        const text = selector
            .extractParagraphTextNodes(document.querySelector("p")!)
            .result.map(node => node.originText)
            .join(" ")
        expect(text).toContain("link")
        expect(text).not.toContain("hidden_secret")
    })
    it("does not request an already translated paragraph when link placeholder numbers differ", async () => {
        document.querySelector("#second")!.innerHTML =
            'Second paragraph with <a href="/second">another useful link</a>.'
        translator = new ImmersiveTranslator(config)
        await translator.startImmersiveTranslation({ manual: true })
        await vi.advanceTimersByTimeAsync(1000)
        const count = service.translate.mock.calls.length
        await translator.translateParagraph(
            document.querySelector("#second a")!
        )
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate).toHaveBeenCalledTimes(count)
        expect(
            document.querySelectorAll("#second .mewcat-container")
        ).toHaveLength(1)
    })
    it("retains explicit supplements across page restarts and target language changes", async () => {
        document.body.innerHTML =
            '<main><p id="included">Regular article paragraph.</p><p id="missed">Manual supplement needs translation.</p></main>'
        vi.mocked(fetch).mockResolvedValue({
            json: async () => ({
                ...rules,
                rules: [],
                generalRule: { ...rules.generalRule, selectors: ["#included"] }
            })
        } as Response)
        translator = new ImmersiveTranslator({
            ...config,
            enableViewportTranslation: true
        })
        await translator.startImmersiveTranslation({ manual: true })
        await vi.advanceTimersByTimeAsync(1200)
        await translator.translateParagraph(document.querySelector("#missed")!)
        await vi.advanceTimersByTimeAsync(1200)
        expect(document.querySelector("#missed .mewcat-wrapper")).not.toBeNull()
        await translator.updateConfig({
            ...config,
            enableViewportTranslation: true,
            targetLanguage: "ja"
        })
        await vi.advanceTimersByTimeAsync(1200)
        expect(document.querySelector("#missed .mewcat-wrapper")).not.toBeNull()
        expect(service.translate.mock.calls.at(-1)![2]).toBe("ja")
        translator.clearAllTranslations({ preserveParagraphTargets: true })
        await translator.startImmersiveTranslation({ manual: true })
        await vi.advanceTimersByTimeAsync(1200)
        expect(document.querySelector("#missed .mewcat-wrapper")).not.toBeNull()
        translator.clearAllTranslations()
        await translator.startImmersiveTranslation({ manual: true })
        await vi.advanceTimersByTimeAsync(1200)
        expect(document.querySelector("#missed .mewcat-wrapper")).toBeNull()
    })
    it.each(["dual", "translation"] as const)(
        "retains, updates and removes manual supplements during page rescans in %s mode",
        async translationDisplayMode => {
            document.body.innerHTML =
                '<main><p id="included">Regular article paragraph.</p><aside><div id="missed"><span>Manual supplement needs translation.</span></div></aside></main>'
            vi.mocked(fetch).mockResolvedValue({
                json: async () => ({
                    ...rules,
                    rules: [],
                    generalRule: {
                        ...rules.generalRule,
                        selectors: ["#included"]
                    }
                })
            } as Response)
            translator = new ImmersiveTranslator({
                ...config,
                translationDisplayMode
            })
            await translator.startImmersiveTranslation({ manual: true })
            await vi.advanceTimersByTimeAsync(200)
            const missed = document.querySelector("#missed")!
            const original = missed.querySelector("span")!.firstChild!
            expect(missed.querySelector(".mewcat-wrapper")).toBeNull()
            await translator.translateParagraph(missed.querySelector("span")!)
            await vi.advanceTimersByTimeAsync(200)
            expect(missed.querySelectorAll(".mewcat-wrapper")).toHaveLength(1)
            expect(translator.getTranslationScope()).toBe("page")
            document
                .querySelector("main")!
                .append(document.createElement("section"))
            await vi.advanceTimersByTimeAsync(300)
            expect(missed.querySelectorAll(".mewcat-wrapper")).toHaveLength(1)
            expect(service.translate).toHaveBeenCalledTimes(2)
            original.textContent = "Updated manual supplement content."
            await vi.advanceTimersByTimeAsync(1000)
            expect(
                missed.querySelector(".mewcat-wrapper")?.textContent
            ).toContain("Updated manual supplement")
            expect(missed.querySelectorAll(".mewcat-container")).toHaveLength(1)
            missed.remove()
            await vi.advanceTimersByTimeAsync(300)
            expect(
                translator.translationNodes.every(
                    node => node.container.isConnected
                )
            ).toBe(true)
            translator.clearAllTranslations()
            expect(missed.querySelector("[data-mewcat-original]")).toBeNull()
            expect(missed.querySelector("span")!.firstChild).toBe(original)
        }
    )
    it("renders code inside links unchanged and restores original nodes after manual translation", async () => {
        document.body.innerHTML =
            '<article><p>Install <a href="/guide">the <code>secret_command</code> package</a> to continue.</p></article>'
        const original = document.querySelector("code")!
        translator = new ImmersiveTranslator({
            ...config,
            translationDisplayMode: "translation"
        })
        await translator.translateParagraph(document.querySelector("p")!)
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate.mock.calls[0][1][0].content).not.toContain(
            "secret_command"
        )
        expect(
            document.querySelector(".mewcat-wrapper a code")?.textContent
        ).toBe("secret_command")
        expect(
            document.querySelector(".mewcat-wrapper a")?.getAttribute("href")
        ).toBe("/guide")
        translator.clearAllTranslations()
        expect(document.querySelector("code")).toBe(original)
    })
    it.each([
        "block",
        "flow-root",
        "flex",
        "grid",
        "list-item",
        "table-cell",
        "table-caption"
    ])("uses the nearest CSS %s container for nested text", async display => {
        document.body.innerHTML = `<section><div id="block" style="display:${display}"><span>Start of paragraph <span id="target">with nested text</span></span><span> and its ending.</span></div><p>Unrelated sibling paragraph.</p></section>`
        const selector = new DomSelector(config)
        await selector.initialize()
        const result = selector.extractParagraphTextNodes(
            document.querySelector("#target")!
        )
        const text = result.result.map(node => node.originText).join(" ")
        expect(text).toContain("Start of paragraph")
        expect(text).toContain("with nested text")
        expect(text).toContain("and its ending.")
        expect(text).not.toContain("Unrelated sibling")
    })
    it("uses actual layout instead of semantic ancestors or display contents", async () => {
        document.body.innerHTML =
            '<section><div style="display:contents"><span id="block" style="display:block">Nearest block <span id="target">needs translation.</span></span></div><p>Unrelated sibling paragraph.</p></section>'
        const selector = new DomSelector(config)
        await selector.initialize()
        const result = selector.extractParagraphTextNodes(
            document.querySelector("#target")!
        )
        expect(result.result.map(node => node.originText).join(" ")).toContain(
            "Nearest block"
        )
        expect(
            result.result.every(node =>
                document.querySelector("#block")!.contains(node.container)
            )
        ).toBe(true)
    })
    it("manually translates content excluded by GitHub without changing page rules", async () => {
        document.body.innerHTML =
            '<main><aside><div id="missed"><span>Account navigation text</span></div></aside><div class="markdown-body"><p>Regular article content.</p></div></main>'
        const selector = new DomSelector({
            ...config,
            currentUrl: "https://github.com/owner/repo",
            currentHostname: "github.com"
        })
        await selector.initialize()
        expect(
            selector
                .extractTargetTextNodes()
                .result.map(node => node.originText)
                .join(" ")
        ).not.toContain("Account navigation")
        expect(
            selector
                .extractParagraphTextNodes(
                    document.querySelector("#missed span")!
                )
                .result.map(node => node.originText)
                .join(" ")
        ).toContain("Account navigation text")
        expect(
            selector
                .extractTargetTextNodes()
                .result.map(node => node.originText)
                .join(" ")
        ).not.toContain("Account navigation")
    })
    it.each([
        "code",
        "pre",
        "kbd",
        "samp",
        "button",
        "[contenteditable]",
        "[role=textbox]"
    ])(
        "does not climb out of protected %s content",
        async protectedSelector => {
            document.body.innerHTML =
                '<article><p>Readable paragraph <code><span>Code text</span></code><kbd>Keyboard code</kbd><samp>Program output</samp></p><pre><span>Source code</span></pre><button>Action text</button><div contenteditable="true">Editable text</div><div role="textbox">Editor text</div></article>'
            const selector = new DomSelector(config)
            await selector.initialize()
            const protectedElement = document.querySelector(protectedSelector)!
            expect(
                selector.extractParagraphTextNodes(
                    protectedElement.firstElementChild ?? protectedElement
                ).result
            ).toHaveLength(0)
        }
    )
    it("preserves code nested inside inline links in a manually selected paragraph", async () => {
        document.body.innerHTML =
            '<article><p>Install <a href="/guide">the <code>secret_command</code> package</a> to continue.</p></article>'
        const selector = new DomSelector(config)
        await selector.initialize()
        const extracted = selector.extractParagraphTextNodes(
            document.querySelector("p")!
        )
        const text = extracted.result.map(node => node.originText).join(" ")
        expect(text).toContain("Install")
        expect(text).toContain("package")
        expect(text).not.toContain("secret_command")
        expect(text).toMatch(/the @\d+# package/)
        expect(
            Object.values(extracted.stayOriginalMap).some(
                node => node.textContent === "secret_command"
            )
        ).toBe(true)
    })
    it("restarts every selected paragraph after the page role changes", async () => {
        document.title = "Machine learning"
        translator = new ImmersiveTranslator({
            ...config,
            enableAutoAiRole: true
        })
        await translator.translateParagraph(document.querySelector("#first")!)
        await translator.translateParagraph(document.querySelector("#second")!)
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate).toHaveBeenCalledTimes(2)
        service.translate.mockClear()
        document.title = "Cognitive psychology"
        await translator.restartParagraphTranslations()
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate).toHaveBeenCalledTimes(2)
        expect(
            service.translate.mock.calls.every(
                call => call[0].aiRole === AiRole.PSYCHOLOGY_TRANSLATOR
            )
        ).toBe(true)
    })

    it("resolves the current page role again before translating a new paragraph", async () => {
        document.title = "Welcome"
        translator = new ImmersiveTranslator({
            ...config,
            aiRole: AiRole.FREE_TRANSLATOR,
            enableAutoAiRole: true
        })
        document.title = "Machine learning"
        await translator.translateParagraph(document.querySelector("#first")!)
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate.mock.calls.at(-1)?.[0].aiRole).toBe(
            AiRole.AI_TRANSLATOR
        )
        document.title = "Cognitive psychology"
        await translator.translateParagraph(document.querySelector("#second")!)
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate.mock.calls.at(-1)?.[0].aiRole).toBe(
            AiRole.PSYCHOLOGY_TRANSLATOR
        )
    })

    it.each([
        "網頁",
        "繁體中文",
        "檔案",
        "網頁瀏覽器",
        "中文繁體轉換",
        "訂閱電子郵件以獲取最新消息。"
    ])(
        "preserves traditional text requiring simplified conversion: %s",
        async text => {
            document.body.innerHTML = `<article><p>${text}</p></article>`
            translator = new ImmersiveTranslator(config)
            expect(
                await translator.translateParagraph(
                    document.querySelector("p")!
                )
            ).toBe(true)
            await vi.advanceTimersByTimeAsync(100)
            expect(service.translate).toHaveBeenCalledTimes(1)
        }
    )
    it("preserves Japanese Han-only text declared on its paragraph", async () => {
        document.body.innerHTML = '<article><p lang="ja">東京都</p></article>'
        translator = new ImmersiveTranslator(config)
        expect(
            await translator.translateParagraph(document.querySelector("p")!)
        ).toBe(true)
        await vi.advanceTimersByTimeAsync(100)
        expect(service.translate).toHaveBeenCalledTimes(1)
    })
    it.each([
        ["zh-TW", "這是已經使用繁體中文編寫的內容。"],
        [
            "en",
            "Please read the instructions carefully before using this application."
        ]
    ])("skips paragraphs that already use %s", async (targetLanguage, text) => {
        document.body.innerHTML = `<article><p>${text}</p></article>`
        translator = new ImmersiveTranslator({ ...config, targetLanguage })
        expect(
            await translator.translateParagraph(document.querySelector("p")!)
        ).toBe(false)
        await vi.advanceTimersByTimeAsync(100)
        expect(service.translate).not.toHaveBeenCalled()
    })
    it.each([
        "你好",
        "这是一个中文段落，无需重复翻译。",
        "请阅读<a href='/help'>使用帮助</a>了解详情。"
    ])(
        "skips target-language paragraphs before requesting translation: %s",
        async text => {
            document.body.innerHTML = `<article><p>${text}</p></article>`
            translator = new ImmersiveTranslator(config)
            expect(
                await translator.translateParagraph(
                    document.querySelector("p")!
                )
            ).toBe(false)
            await vi.advanceTimersByTimeAsync(200)
            expect(service.translate).not.toHaveBeenCalled()
            expect(document.querySelector(".mewcat-container")).toBeNull()
        }
    )
    it("filters Chinese paragraphs without dropping foreign text on a mixed page", async () => {
        document.body.innerHTML =
            "<article><p>这是已经使用中文编写的内容。</p><p>Read the instructions before you start using this application.</p><p>日本語の文章を翻訳してください。</p><p>中文说明 Please read the instructions carefully.</p></article>"
        const selector = new DomSelector(config)
        await selector.initialize()
        const result = selector.extractTargetTextNodes(document.body, true)
        expect(result.result).toHaveLength(3)
        expect(
            result.result.every(
                node => !node.originText.includes("已经使用中文")
            )
        ).toBe(true)
    })
    it.each([
        ["zh-CN", "設置"],
        ["zh-TW", "设置"],
        ["en", "这是需要翻译为英文的中文段落。"]
    ])("preserves conversion to %s for %s", async (targetLanguage, text) => {
        document.body.innerHTML = `<article><p>${text}</p></article>`
        translator = new ImmersiveTranslator({ ...config, targetLanguage })
        expect(
            await translator.translateParagraph(document.querySelector("p")!)
        ).toBe(true)
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate).toHaveBeenCalledTimes(1)
    })
    it("uses the new target language after a configuration update", async () => {
        document.body.innerHTML =
            "<article><p>这是需要翻译为英文的中文段落。</p></article>"
        translator = new ImmersiveTranslator(config)
        await translator.updateConfig({ ...config, targetLanguage: "en" })
        expect(
            await translator.translateParagraph(document.querySelector("p")!)
        ).toBe(true)
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate).toHaveBeenCalledTimes(1)
    })
    it("follows the CSS parent block when a semantic paragraph is styled inline", async () => {
        document.querySelector<HTMLElement>("#first")!.style.display = "inline"
        translator = new ImmersiveTranslator(config)
        await translator.translateParagraph(document.querySelector("#first a")!)
        await vi.advanceTimersByTimeAsync(250)
        expect(
            document.querySelectorAll("article .mewcat-wrapper")
        ).toHaveLength(2)
        expect(document.querySelector("#second .mewcat-wrapper")).not.toBeNull()
        expect(service.translate).toHaveBeenCalledTimes(2)
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
        ).toHaveLength(2)
        expect(
            selector.extractParagraphTextNodes(document.body).result
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
