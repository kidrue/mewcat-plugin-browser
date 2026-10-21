// @vitest-environment jsdom
import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { afterEach, expect, it, vi } from "vitest"

import SidePanel from "../src/sidepanel"

const mocks = vi.hoisted(() => ({ translate: vi.fn() }))
vi.mock("@/state/config", () => ({
    useConfig: () => ({ targetLanguage: "ja", detectedLanguage: "en" })
}))
vi.mock("@/translation/translationService", () => ({
    translateText: mocks.translate
}))
vi.mock("@/components/SkyArtwork", () => ({ SkyMascot: () => null }))
vi.mock("@/components/BrandLogo", () => ({ default: () => null }))
vi.mock("@/components/TranslationMark", () => ({ default: () => null }))

let root: ReturnType<typeof createRoot>
afterEach(async () => {
    await act(async () => root?.unmount())
    vi.clearAllMocks()
})
async function render() {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    document.body.innerHTML = "<div id='host'></div>"
    root = createRoot(document.getElementById("host")!)
    await act(async () => root.render(<SidePanel />))
}
function button(text: string) {
    return [...document.querySelectorAll("button")].find(
        b => b.textContent?.trim() === text
    )!
}
async function input(text: string) {
    const el = document.querySelector("textarea")!
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value"
        )!.set!.call(el, text)
        el.dispatchEvent(new Event("input", { bubbles: true }))
    })
}
it("inherits target language and rejects a result after clearing the input", async () => {
    let resolve!: (value: string) => void
    mocks.translate.mockReturnValue(
        new Promise<string>(r => {
            resolve = r
        })
    )
    await render()
    await input("hello")
    await act(async () => button("翻译").click())
    expect(mocks.translate.mock.calls[0][2]).toBe("ja")
    await act(async () =>
        document.querySelector<HTMLButtonElement>('[title="清空"]')!.click()
    )
    await act(async () => resolve("旧结果"))
    expect(document.body.textContent).not.toContain("旧结果")
    expect(button("翻译").disabled).toBe(true)
})
it("explains clipboard read failures", async () => {
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { readText: vi.fn().mockRejectedValue(new Error("denied")) }
    })
    await render()
    await act(async () => button("粘贴").click())
    expect(document.body.textContent).toContain("请使用 Ctrl+V")
})
it("keeps the newest result when an older request finishes later", async () => {
    let resolve!: (value: string) => void
    mocks.translate
        .mockReturnValueOnce(
            new Promise<string>(r => {
                resolve = r
            })
        )
        .mockResolvedValueOnce("新译文")
    await render()
    await input("first")
    await act(async () => button("翻译").click())
    await input("second")
    await act(async () => button("翻译").click())
    await act(async () => resolve("旧译文"))
    expect(document.body.textContent).toContain("新译文")
    expect(document.body.textContent).not.toContain("旧译文")
})
it("explains clipboard write failures", async () => {
    mocks.translate.mockResolvedValueOnce("译文")
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
    })
    await render()
    await input("hello")
    await act(async () => button("翻译").click())
    await act(async () => button("复制").click())
    expect(document.body.textContent).toContain("复制失败")
})
