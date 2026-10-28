import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { registerExtensionNavigation } from "../src/background/lib/extension-navigation"

let listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0]
const open = vi.fn()
const respond = vi.fn()
beforeEach(() => {
    open.mockReset().mockResolvedValue(undefined)
    respond.mockReset()
    vi.stubGlobal("chrome", {
        runtime: {
            getURL: (path: string) => `chrome-extension://mewcat/${path}`,
            onMessage: {
                addListener: vi.fn(value => {
                    listener = value
                })
            }
        },
        sidePanel: { open },
        tabs: { create: vi.fn((_options, callback) => callback()) }
    })
    registerExtensionNavigation()
})
afterEach(() => vi.unstubAllGlobals())

describe("extension navigation", () => {
    it("opens the sender tab synchronously to preserve the user gesture", async () => {
        expect(
            listener(
                { type: "OPEN_SIDE_PANEL" },
                { tab: { id: 0 } } as chrome.runtime.MessageSender,
                respond
            )
        ).toBe(true)
        expect(open).toHaveBeenCalledWith({ tabId: 0 })
        await Promise.resolve()
        expect(respond).toHaveBeenCalledWith({ success: true })
    })
    it("reports side panel failures", async () => {
        open.mockRejectedValue(new Error("No user gesture"))
        listener(
            { type: "OPEN_SIDE_PANEL" },
            { tab: { id: 7 } } as chrome.runtime.MessageSender,
            respond
        )
        await Promise.resolve()
        expect(respond).toHaveBeenCalledWith(
            expect.objectContaining({ success: false })
        )
    })
    it("rejects requests without a sender tab", () => {
        listener({ type: "OPEN_SIDE_PANEL" }, {}, respond)
        expect(open).not.toHaveBeenCalled()
        expect(respond).toHaveBeenCalledWith(
            expect.objectContaining({ success: false })
        )
    })
    it("handles browsers without the side panel API", () => {
        Object.assign(chrome, { sidePanel: undefined })
        listener(
            { type: "OPEN_SIDE_PANEL" },
            { tab: { id: 7 } } as chrome.runtime.MessageSender,
            respond
        )
        expect(respond).toHaveBeenCalledWith(
            expect.objectContaining({ success: false })
        )
    })
    it("opens the full options page with its supported section", () => {
        listener({ type: "OPEN_OPTIONS", section: "translation" }, {}, respond)
        expect(chrome.tabs.create).toHaveBeenCalledWith(
            { url: "chrome-extension://mewcat/options.html#translation" },
            expect.any(Function)
        )
        expect(respond).toHaveBeenCalledWith({ success: true })
    })
    it("does not claim unrelated message channels", () => {
        expect(listener({ type: "TRANSLATE_END" }, {}, respond)).toBeUndefined()
        expect(respond).not.toHaveBeenCalled()
    })
})
