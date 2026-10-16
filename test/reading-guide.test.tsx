// @vitest-environment jsdom
import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { afterEach, expect, it, vi } from "vitest"

import ReadingGuide from "../src/components/ReadingGuide"

let root: ReturnType<typeof createRoot>
afterEach(async () => {
    await act(async () => root?.unmount())
    vi.unstubAllGlobals()
})
it("skips persistently without changing the language and can reopen help", async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    const change = vi.fn()
    vi.stubGlobal("chrome", {
        storage: { local: { get: vi.fn().mockResolvedValue({}), set } }
    })
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    document.body.innerHTML = "<div id='host'></div>"
    root = createRoot(document.getElementById("host")!)
    await act(async () =>
        root.render(
            <ReadingGuide targetLanguage="ja" onTargetLanguageChange={change} />
        )
    )
    expect(document.body.textContent).toContain("无需 API Key")
    const find = (text: string) =>
        [...document.querySelectorAll("button")].find(
            button => button.textContent === text
        )!
    await act(async () => find("跳过").click())
    expect(set).toHaveBeenCalledTimes(1)
    expect(change).not.toHaveBeenCalled()
    expect(document.querySelector('[aria-label="使用引导"]')).toBeNull()
    await act(async () => find("查看使用引导").click())
    expect(document.querySelector('[aria-label="使用引导"]')).not.toBeNull()
})
