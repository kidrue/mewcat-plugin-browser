// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

describe("translation button cache refresh", () => {
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
