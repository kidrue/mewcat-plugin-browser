// @vitest-environment jsdom
import { getDefaultStore, type PrimitiveAtom } from "jotai"
import React, { type ReactNode } from "react"
import type { Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { configAtom } from "@/state"

import { defaultExtensionConfig } from "../src/state/constants"
import { AiModel_Platform_Enum } from "../src/types/aiModel"
import type { ExtensionConfig } from "../src/types/config"

type MessageListener = Parameters<
    typeof chrome.runtime.onMessage.addListener
>[0]
const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act
const writableConfigAtom =
    configAtom as unknown as PrimitiveAtom<ExtensionConfig>

const mocks = vi.hoisted(() => ({
    send: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    open: vi.fn(),
    toast: vi.fn(),
    roots: [] as Array<{ root: Root; container: Element }>,
    listeners: new Set<MessageListener>()
}))
vi.mock("@/messaging", () => ({ sendMessage: mocks.send }))
vi.mock("@/monitoring", () => ({ captureExtensionException: vi.fn() }))
vi.mock("@/utils/fonts", () => ({ registerUiFonts: vi.fn() }))
vi.mock("@/utils/toast", () => ({
    Toast: { show: mocks.toast },
    ToastType: { ERROR: "error" }
}))
vi.mock("@/components/MonitoringErrorBoundary", () => ({
    MonitoringErrorBoundary: ({ children }: { children: ReactNode }) => children
}))
vi.mock("@/state", async () => {
    const { atom } = await import("jotai")
    return { configAtom: atom({}) }
})
vi.mock("#imports", () => ({ defineContentScript: (value: unknown) => value }))
vi.mock("react-dom/client", async importOriginal => {
    const original = await importOriginal<typeof import("react-dom/client")>()
    return {
        ...original,
        createRoot: (container: Element) => {
            const root = original.createRoot(container)
            mocks.roots.push({ root, container })
            return root
        }
    }
})
vi.mock("../src/page-summary/PageSummaryRenderer", () => ({
    renderPageSummary: () => ({
        update: mocks.update,
        remove: mocks.remove,
        open: mocks.open
    })
}))

const config = {
    ...defaultExtensionConfig,
    enablePageSummary: true,
    currentModel: "summary-model",
    aiModelList: [
        {
            id: "summary-model",
            enabled: true,
            type: AiModel_Platform_Enum.DEEPSEEK,
            name: "DeepSeek",
            params: {
                apiKey: "test-key",
                modelName: "test-model",
                isOfficial: true
            }
        }
    ]
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    vi.stubGlobal("chrome", {
        runtime: {
            onMessage: {
                addListener: (listener: MessageListener) =>
                    mocks.listeners.add(listener),
                removeListener: (listener: MessageListener) =>
                    mocks.listeners.delete(listener)
            }
        }
    })
    document.body.innerHTML = `<article><h1>Guide</h1><p>${"Useful article content. ".repeat(30)}</p></article>`
    getDefaultStore().set(writableConfigAtom, structuredClone(config))
    mocks.send.mockResolvedValue({ success: true, text: "页面总结。" })
})
afterEach(async () => {
    await act(async () =>
        mocks.roots.splice(0).forEach(({ root, container }) => {
            root.unmount()
            container.remove()
        })
    )
    mocks.listeners.clear()
    vi.unstubAllGlobals()
})

async function mountSummary() {
    const { default: entrypoint } = await import(
        "../src/entrypoints/page-summary.content"
    )
    await act(async () => {
        await entrypoint.main({} as never)
    })
}

describe("page summary configuration lifecycle", () => {
    const press = async (init: KeyboardEventInit = {}) => {
        const event = new KeyboardEvent("keydown", {
            code: "KeyS",
            altKey: true,
            bubbles: true,
            cancelable: true,
            ...init
        })
        await act(async () => document.dispatchEvent(event))
        return event
    }

    it("opens manually with automatic summaries off and reuses the result", async () => {
        getDefaultStore().set(writableConfigAtom, {
            ...config,
            enablePageSummary: false
        })
        await mountSummary()
        expect(mocks.send).not.toHaveBeenCalled()
        expect((await press()).defaultPrevented).toBe(true)
        expect(mocks.open).toHaveBeenCalledTimes(1)
        expect(mocks.update).toHaveBeenCalledWith(
            expect.objectContaining({ status: "success" })
        )
        await press()
        expect(mocks.open).toHaveBeenCalledTimes(2)
        expect(mocks.send).toHaveBeenCalledTimes(1)
    })

    it("opens an in-flight summary without another request", async () => {
        let resolve!: (value: unknown) => void
        mocks.send.mockReturnValue(
            new Promise(done => {
                resolve = done
            })
        )
        await mountSummary()
        await press()
        await press()
        expect(mocks.open).toHaveBeenCalledTimes(2)
        expect(mocks.send).toHaveBeenCalledTimes(1)
        await act(async () => resolve({ success: true, text: "已完成。" }))
    })

    it("rebinds and disables shortcuts immediately without clearing the result", async () => {
        await mountSummary()
        const removed = mocks.remove.mock.calls.length
        await act(async () =>
            getDefaultStore().set(writableConfigAtom, {
                ...config,
                pageSummaryShortcut: "F8"
            })
        )
        await press()
        expect(mocks.open).not.toHaveBeenCalled()
        await press({ code: "F8", altKey: false })
        expect(mocks.open).toHaveBeenCalledTimes(1)
        await act(async () =>
            getDefaultStore().set(writableConfigAtom, {
                ...config,
                pageSummaryShortcut: ""
            })
        )
        await press({ code: "F8", altKey: false })
        await press()
        expect(mocks.open).toHaveBeenCalledTimes(1)
        expect(mocks.send).toHaveBeenCalledTimes(1)
        expect(mocks.remove).toHaveBeenCalledTimes(removed)
    })

    it("does not intercept shortcuts when the extension is disabled", async () => {
        getDefaultStore().set(writableConfigAtom, {
            ...config,
            extensionEnabled: false,
            enablePageSummary: false
        })
        await mountSummary()
        expect((await press()).defaultPrevented).toBe(false)
        expect(mocks.send).not.toHaveBeenCalled()
        expect(mocks.open).not.toHaveBeenCalled()
    })

    it.each([
        { repeat: true },
        { isComposing: true },
        { keyCode: 229 },
        { code: "KeyQ" }
    ])("ignores typing and repeated or unrelated events (%j)", async init => {
        await mountSummary()
        expect((await press(init)).defaultPrevented).toBe(false)
        expect(mocks.open).not.toHaveBeenCalled()
    })

    it.each([
        "<input>",
        "<textarea></textarea>",
        '<div contenteditable="true"><span tabindex="0"></span></div>',
        '<div role="textbox"><span tabindex="0"></span></div>'
    ])("does not open while editing in %s", async markup => {
        await mountSummary()
        const wrapper = document.createElement("div")
        wrapper.innerHTML = markup
        document.body.append(wrapper)
        const target = wrapper.querySelector<HTMLElement>(
            "span, input, textarea"
        )!
        target.focus()
        const event = new KeyboardEvent("keydown", {
            code: "KeyS",
            altKey: true,
            bubbles: true,
            cancelable: true
        })
        await act(async () => target.dispatchEvent(event))
        expect(event.defaultPrevented).toBe(false)
        expect(mocks.open).not.toHaveBeenCalled()
    })

    it("protects an editor inside a shadow root", async () => {
        await mountSummary()
        const host = document.createElement("div")
        const shadow = host.attachShadow({ mode: "open" })
        shadow.innerHTML = "<input>"
        document.body.append(host)
        const input = shadow.querySelector("input")!
        input.focus()
        const event = new KeyboardEvent("keydown", {
            code: "KeyS",
            altKey: true,
            bubbles: true,
            composed: true,
            cancelable: true
        })
        await act(async () => input.dispatchEvent(event))
        expect(mocks.open).not.toHaveBeenCalled()
        expect(event.defaultPrevented).toBe(false)
    })

    it.each(["excluded", "short"])(
        "explains why %s content cannot be summarized",
        async kind => {
            getDefaultStore().set(writableConfigAtom, {
                ...config,
                enablePageSummary: false,
                pageSummaryDisabledSites:
                    kind === "excluded" ? [location.hostname] : []
            })
            if (kind === "short") document.body.innerHTML = "<p>short</p>"
            await mountSummary()
            await press()
            expect(mocks.send).not.toHaveBeenCalled()
            expect(mocks.toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining(
                        kind === "excluded" ? "禁用" : "不足"
                    )
                })
            )
        }
    )

    it("removes the keyboard listener on unmount", async () => {
        await mountSummary()
        await act(async () =>
            mocks.roots.splice(0).forEach(({ root, container }) => {
                root.unmount()
                container.remove()
            })
        )
        await press()
        expect(mocks.open).not.toHaveBeenCalled()
    })

    it.each([false, true])(
        "does not repeat a summary on language detection (pending: %s)",
        async pending => {
            let resolve: ((value: unknown) => void) | undefined
            if (pending)
                mocks.send.mockReturnValue(
                    new Promise(done => {
                        resolve = done
                    })
                )
            await mountSummary()
            expect(mocks.send).toHaveBeenCalledTimes(1)
            await act(async () => {
                getDefaultStore().set(writableConfigAtom, {
                    ...structuredClone(config),
                    detectedLanguage: "en"
                })
            })
            expect(mocks.send).toHaveBeenCalledTimes(1)
            if (resolve)
                await act(async () =>
                    resolve!({ success: true, text: "页面总结。" })
                )
            expect(mocks.update).toHaveBeenCalledTimes(1)
        }
    )

    it("uses new summary settings and ignores the superseded response", async () => {
        const responses: Array<(value: unknown) => void> = []
        mocks.send.mockImplementation(
            () => new Promise(resolve => responses.push(resolve))
        )
        await mountSummary()
        await act(async () => {
            getDefaultStore().set(writableConfigAtom, {
                ...structuredClone(config),
                targetLanguage: "en"
            })
        })
        expect(mocks.send).toHaveBeenCalledTimes(2)
        expect(mocks.send.mock.calls[1][1].messages[0].content).toContain(
            "请用en"
        )
        await act(async () => responses[0]({ success: true, text: "旧总结。" }))
        expect(mocks.update).not.toHaveBeenCalled()
        await act(async () =>
            responses[1]({ success: true, text: "New summary." })
        )
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ summary: "New summary." })
        )
        expect(mocks.listeners.size).toBe(2)
    })

    it("opens the existing result when the summary action is delivered again", async () => {
        await mountSummary()
        const respond = vi.fn()
        await act(async () => {
            for (const listener of mocks.listeners)
                listener({ type: "MEWCAT_SUMMARY_ACTION" }, {}, respond)
        })
        expect(respond).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        )
        expect(mocks.open).toHaveBeenCalledTimes(1)
        expect(mocks.send).toHaveBeenCalledTimes(1)
    })
})
