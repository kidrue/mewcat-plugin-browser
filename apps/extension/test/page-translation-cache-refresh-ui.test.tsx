// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type {
    PageActionRequest,
    ReadingState
} from "../src/reading/pageActions"
import type { ExtensionConfig } from "../src/types/config"

const mocks = vi.hoisted(() => ({
    calls: [] as string[],
    config: {
        isSelectedTranslate: true,
        targetLanguage: "zh-CN",
        detectedLanguage: "auto",
        currentModel: "google-translate",
        aiRole: "DEFAULT",
        aiModelList: [],
        selectionTriggerMode: "direct",
        autoTranslateDelay: 700,
        alwaysTranslateUrls: []
    } as ExtensionConfig,
    clearCache: vi.fn().mockResolvedValue(2),
    translate: vi.fn().mockResolvedValue(true),
    showToast: vi.fn(),
    updateConfig: vi.fn().mockResolvedValue(undefined)
}))

vi.mock("jotai", () => ({
    useAtom: () => [mocks.config]
}))

vi.mock("../src/state", () => ({
    configAtom: Symbol("configAtom")
}))

vi.mock("@/state", () => ({
    configAtom: Symbol("configAtom")
}))

vi.mock("../src/components/SettingsPanel", () => ({
    default: () => null
}))

vi.mock("../src/components/Tooltip", () => ({
    default: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock("../src/hooks/useDrag", () => ({
    useDrag: () => ({
        ref: { current: null },
        position: { x: 100, y: 100 },
        isDragging: false,
        isDragged: { current: false }
    })
}))

vi.mock("../src/translation/ImmersiveTranslator", () => ({
    ImmersiveTranslator: class {
        setSourceLanguage() {}
        getReadingProgress() {
            return { translated: 0, failed: 0, busy: false }
        }
        async retryFailedTranslations() {}
        async startImmersiveTranslation() {
            mocks.calls.push("translate")
            return mocks.translate()
        }

        async clearCurrentPageTranslationCache() {
            mocks.calls.push("clear-cache")
            return mocks.clearCache()
        }

        clearAllTranslations() {
            mocks.calls.push("clear-translations")
        }

        async updateConfig() {
            return mocks.updateConfig()
        }
    }
}))

vi.mock("../src/utils/toast", () => ({
    Toast: { show: mocks.showToast },
    ToastType: { SUCCESS: "success", ERROR: "error" }
}))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

let root: Root | undefined
let shadowRoot: ShadowRoot

async function click(element: Element) {
    await act(async () => {
        element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
        await Promise.resolve()
    })
}

beforeEach(() => {
    mocks.config.detectedLanguage = "auto"
    mocks.config.alwaysTranslateUrls = []
    mocks.config.currentModel = "google-translate"
    mocks.calls.length = 0
    mocks.clearCache.mockReset().mockResolvedValue(2)
    mocks.translate.mockReset().mockResolvedValue(true)
    mocks.showToast.mockReset()
    mocks.updateConfig.mockClear()
    document.body.innerHTML =
        '<div id="translation-control-center-overlay"></div>'
    const host = document.querySelector<HTMLDivElement>(
        "#translation-control-center-overlay"
    )!
    shadowRoot = host.attachShadow({ mode: "open" })
    const mountPoint = document.createElement("div")
    shadowRoot.appendChild(mountPoint)
    root = createRoot(mountPoint)
    Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: true,
        chrome: {
            runtime: {
                getURL: (path: string) => `chrome-extension://mewcat/${path}`,
                sendMessage: vi.fn(),
                onMessage: {
                    addListener: vi.fn(),
                    removeListener: vi.fn()
                }
            }
        }
    })
})

afterEach(async () => {
    if (root) {
        await act(async () => root?.unmount())
        root = undefined
    }
})

const englishArticle =
    "The researchers published a detailed report about the development of new technology. " +
    "Their findings explain how people can use these tools to understand the world and share information."
const chineseArticle =
    "这是一个关于科学技术发展的中文网页，我们可以在这里阅读研究报告，了解新的发现和更多信息。"

async function renderPage(text: string) {
    const article = document.createElement("article")
    article.textContent = text
    document.body.prepend(article)
    const { default: TranslationControlCenter } = await import(
        "../src/contents/TranslationControlCenter"
    )
    await act(async () => root?.render(<TranslationControlCenter />))
    return article
}

async function pageAction(
    action: PageActionRequest["action"],
    sourceLanguage?: string
): Promise<ReadingState> {
    let state: ReadingState
    await act(async () => {
        state = await new Promise<ReadingState>(resolve => {
            for (const [listener] of vi.mocked(
                chrome.runtime.onMessage.addListener
            ).mock.calls) {
                listener(
                    { type: "MEWCAT_PAGE_ACTION", action, sourceLanguage },
                    {} as chrome.runtime.MessageSender,
                    resolve
                )
            }
        })
    })
    return state!
}

describe("page source language detection", () => {
    it("returns the current page language instead of another tab's saved language", async () => {
        mocks.config.detectedLanguage = "zh-CN"
        await renderPage(englishArticle)
        expect((await pageAction("status")).sourceLanguage).toBe("en")
    })

    it("preserves a manual override and detects again when automatic mode is selected", async () => {
        await renderPage(englishArticle)
        expect((await pageAction("source", "ja")).sourceLanguage).toBe("ja")
        expect((await pageAction("status")).sourceLanguage).toBe("ja")
        expect((await pageAction("source", "auto")).sourceLanguage).toBe("en")
    })

    it("waits for readable content instead of treating an empty page as English", async () => {
        const article = await renderPage("")
        expect((await pageAction("status")).sourceLanguage).toBe("auto")
        article.textContent = chineseArticle.repeat(3)
        expect((await pageAction("status")).sourceLanguage).toBe("zh-CN")
    })

    it("keeps the detected source language when translated text appears", async () => {
        const article = await renderPage(englishArticle)
        expect((await pageAction("status")).sourceLanguage).toBe("en")
        await pageAction("start")
        article.textContent = chineseArticle.repeat(3)
        expect((await pageAction("status")).sourceLanguage).toBe("en")
    })

    it("does not detect translated text when the original language was unknown", async () => {
        const article = await renderPage("1234")
        expect((await pageAction("start")).sourceLanguage).toBe("auto")
        article.textContent = chineseArticle.repeat(3)
        expect((await pageAction("status")).sourceLanguage).toBe("auto")
    })

    it("detects new content arriving after the SPA URL update", async () => {
        const originalUrl = location.href
        const article = await renderPage(englishArticle)
        expect((await pageAction("status")).sourceLanguage).toBe("en")
        try {
            history.replaceState(null, "", "/different-language")
            await act(async () => {
                for (const [listener] of vi.mocked(
                    chrome.runtime.onMessage.addListener
                ).mock.calls) {
                    listener(
                        { type: "TAB_UPDATED" },
                        {} as chrome.runtime.MessageSender,
                        () => {}
                    )
                }
            })
            expect((await pageAction("status")).sourceLanguage).toBe("en")
            article.textContent = chineseArticle.repeat(3)
            expect((await pageAction("status")).sourceLanguage).toBe("zh-CN")
        } finally {
            history.replaceState(null, "", originalUrl)
        }
    })
})

describe("translation button cache refresh", () => {
    it("ignores unrelated extension messages without claiming their response channel", async () => {
        const { default: TranslationControlCenter } = await import(
            "../src/contents/TranslationControlCenter"
        )
        await act(async () => root?.render(<TranslationControlCenter />))
        const listeners = vi
            .mocked(chrome.runtime.onMessage.addListener)
            .mock.calls.map(call => call[0])
        for (const listener of listeners) {
            expect(
                listener(
                    { type: "OTHER_FEATURE_MESSAGE" },
                    {} as chrome.runtime.MessageSender,
                    () => {}
                )
            ).toBeUndefined()
        }
    })
    it("ignores a failed refresh after a newer translation has started", async () => {
        const { default: TranslationControlCenter } = await import(
            "../src/contents/TranslationControlCenter"
        )
        await act(async () => root?.render(<TranslationControlCenter />))
        await click(shadowRoot.querySelector('[aria-label="开启翻译"]')!)
        let reject!: (error: Error) => void
        mocks.translate.mockReturnValueOnce(
            new Promise<boolean>((_resolve, r) => {
                reject = r
            })
        )
        await click(
            shadowRoot.querySelector('[aria-label="清除当前页缓存并重新翻译"]')!
        )
        const listeners = vi
            .mocked(chrome.runtime.onMessage.addListener)
            .mock.calls.map(call => call[0])
        const send = (action: string) => {
            for (const listener of listeners)
                listener(
                    { type: "MEWCAT_PAGE_ACTION", action },
                    {} as chrome.runtime.MessageSender,
                    () => {}
                )
        }
        await act(async () => send("clear"))
        expect(
            shadowRoot.querySelector('[aria-label="开启翻译"]')
        ).not.toBeNull()
        await act(async () => send("start"))
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
        await act(async () => reject(new Error("obsolete request")))
        errorLog.mockRestore()
        expect(
            shadowRoot.querySelector('[aria-label="清理翻译"]')
        ).not.toBeNull()
        expect(mocks.showToast).not.toHaveBeenCalled()
    })
    it("starts the new model while the old model request is still pending", async () => {
        let resolve!: (value: boolean) => void
        mocks.translate.mockReturnValueOnce(
            new Promise<boolean>(r => {
                resolve = r
            })
        )
        const { default: TranslationControlCenter } = await import(
            "../src/contents/TranslationControlCenter"
        )
        await act(async () => root?.render(<TranslationControlCenter />))
        await click(shadowRoot.querySelector('[aria-label="开启翻译"]')!)
        mocks.config = { ...mocks.config, currentModel: "microsoft-translate" }
        await act(async () => root?.render(<TranslationControlCenter />))
        expect(mocks.translate).toHaveBeenCalledTimes(2)
        await act(async () => resolve(true))
        expect(
            shadowRoot.querySelector('[aria-label="清理翻译"]')
        ).not.toBeNull()
    })
    it("keeps the original when cache clearing finishes after a clear action", async () => {
        const { default: TranslationControlCenter } = await import(
            "../src/contents/TranslationControlCenter"
        )
        await act(async () => root?.render(<TranslationControlCenter />))
        await click(shadowRoot.querySelector('[aria-label="开启翻译"]')!)
        let resolve!: (value: number) => void
        mocks.clearCache.mockReturnValueOnce(
            new Promise<number>(r => {
                resolve = r
            })
        )
        await click(
            shadowRoot.querySelector('[aria-label="清除当前页缓存并重新翻译"]')!
        )
        const listeners = vi
            .mocked(chrome.runtime.onMessage.addListener)
            .mock.calls.map(call => call[0])
        await act(async () => {
            for (const listener of listeners)
                listener(
                    { type: "MEWCAT_PAGE_ACTION", action: "clear" },
                    {} as chrome.runtime.MessageSender,
                    () => {}
                )
        })
        await act(async () => resolve(2))
        expect(mocks.translate).toHaveBeenCalledTimes(1)
    })
    it("does not restart automatic translation after showing the original during navigation", async () => {
        vi.useFakeTimers()
        mocks.config.alwaysTranslateUrls = [window.location.hostname]
        const { default: TranslationControlCenter } = await import(
            "../src/contents/TranslationControlCenter"
        )
        await act(async () => root?.render(<TranslationControlCenter />))
        await act(async () => vi.advanceTimersByTimeAsync(700))
        expect(mocks.translate).toHaveBeenCalledTimes(1)
        window.history.pushState(null, "", "/next-article")
        const listeners = vi
            .mocked(chrome.runtime.onMessage.addListener)
            .mock.calls.map(call => call[0])
        const send = (message: unknown) => {
            for (const listener of listeners)
                listener(message, {} as chrome.runtime.MessageSender, () => {})
        }
        await act(async () => send({ type: "TAB_UPDATED" }))
        await act(async () =>
            send({ type: "MEWCAT_PAGE_ACTION", action: "clear" })
        )
        await act(async () => vi.advanceTimersByTimeAsync(1000))
        expect(mocks.translate).toHaveBeenCalledTimes(1)
        window.history.replaceState(null, "", "/")
        vi.useRealTimers()
    })
    it("uses the generated extension icon as the floating translation logo", async () => {
        const { default: TranslationControlCenter } = await import(
            "../src/contents/TranslationControlCenter"
        )
        await act(async () => root?.render(<TranslationControlCenter />))

        const logo = shadowRoot.querySelector<HTMLImageElement>(
            'img[src="chrome-extension://mewcat/icons/128.png"]'
        )

        expect(logo).not.toBeNull()
        expect(logo?.getAttribute("alt")).toBe("")
        expect(logo?.draggable).toBe(false)
    })

    it("clears the page cache and retranslates from the hover action", async () => {
        const { default: TranslationControlCenter } = await import(
            "../src/contents/TranslationControlCenter"
        )
        await act(async () => root?.render(<TranslationControlCenter />))

        const translateButton = shadowRoot.querySelector(
            '[aria-label="开启翻译"]'
        )
        expect(translateButton).not.toBeNull()
        expect(
            shadowRoot.querySelector('[aria-label="清除当前页缓存并重新翻译"]')
        ).toBeNull()

        await click(translateButton!)
        await act(async () => {
            translateButton?.dispatchEvent(
                new window.MouseEvent("mouseover", { bubbles: true })
            )
        })

        const refreshButton = shadowRoot.querySelector(
            '[aria-label="清除当前页缓存并重新翻译"]'
        )
        expect(refreshButton).not.toBeNull()
        await click(refreshButton!)

        expect(mocks.calls).toEqual([
            "translate",
            "clear-cache",
            "clear-translations",
            "translate"
        ])
        expect(mocks.showToast).toHaveBeenCalledWith({
            type: "success",
            message: "已刷新当前页面翻译"
        })
    })

    it("reports a cache deletion failure without retranslating", async () => {
        mocks.clearCache.mockRejectedValueOnce(new Error("IndexedDB failed"))
        const { default: TranslationControlCenter } = await import(
            "../src/contents/TranslationControlCenter"
        )
        await act(async () => root?.render(<TranslationControlCenter />))

        const translateButton = shadowRoot.querySelector(
            '[aria-label="开启翻译"]'
        )!
        await click(translateButton)
        await act(async () => {
            translateButton.dispatchEvent(
                new window.MouseEvent("mouseover", { bubbles: true })
            )
        })
        const refreshButton = shadowRoot.querySelector(
            '[aria-label="清除当前页缓存并重新翻译"]'
        )!
        await click(refreshButton)

        expect(mocks.calls).toEqual(["translate", "clear-cache"])
        expect(mocks.showToast).toHaveBeenCalledWith({
            type: "error",
            message: "刷新翻译失败，请稍后重试"
        })
        expect((refreshButton as HTMLButtonElement).disabled).toBe(false)
    })

    it("restores the idle state when retranslation produces no result", async () => {
        mocks.translate.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        const { default: TranslationControlCenter } = await import(
            "../src/contents/TranslationControlCenter"
        )
        await act(async () => root?.render(<TranslationControlCenter />))

        const translateButton = shadowRoot.querySelector(
            '[aria-label="开启翻译"]'
        )!
        await click(translateButton)
        await act(async () => {
            translateButton.dispatchEvent(
                new window.MouseEvent("mouseover", { bubbles: true })
            )
        })
        await click(
            shadowRoot.querySelector('[aria-label="清除当前页缓存并重新翻译"]')!
        )

        expect(
            shadowRoot.querySelector('[aria-label="开启翻译"]')
        ).not.toBeNull()
        expect(mocks.showToast).toHaveBeenLastCalledWith({
            type: "error",
            message: "刷新翻译失败，请稍后重试"
        })
    })
})
