import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { registerFrameTranslation } from "../src/background/lib/frame-translation"

let listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0]
let completed: (details: { tabId: number; frameId: number }) => Promise<void>
let committed: (details: { tabId: number; frameId: number }) => void
let removed: (tabId: number) => void
let state: Record<string, unknown>
let frames: Record<string, unknown>[]
const executeScript = vi.fn()
const sendMessage = vi.fn()
const sender = { id: "extension", tab: { id: 9 }, frameId: 0 }
async function request(type: string, frameId = 0) {
    const respond = vi.fn()
    listener({ type }, { ...sender, frameId }, respond)
    await vi.waitFor(() => expect(respond).toHaveBeenCalled())
    return respond.mock.calls[0][0]
}
beforeEach(() => {
    state = {
        sessionId: "page-1",
        revision: 1,
        enabled: true,
        sourceLanguage: "en",
        manual: true
    }
    frames = [
        { frameId: 0, url: "https://news.example/article" },
        {
            frameId: 2,
            documentId: "comments-1",
            url: "https://disqus.com/embed/comments"
        },
        { frameId: 3, documentId: "blocked", url: "chrome://settings" }
    ]
    executeScript.mockReset().mockResolvedValue([])
    sendMessage
        .mockReset()
        .mockImplementation((_tab, message, _options, callback) => {
            callback?.(
                message.type === "MEWCAT_FRAME_STATE"
                    ? state
                    : { success: true }
            )
        })
    vi.stubGlobal("chrome", {
        runtime: {
            id: "extension",
            onMessage: { addListener: vi.fn(fn => (listener = fn)) }
        },
        tabs: {
            sendMessage,
            onRemoved: { addListener: vi.fn(fn => (removed = fn)) }
        },
        scripting: { executeScript },
        webNavigation: {
            getAllFrames: vi.fn(async () => frames),
            onCompleted: { addListener: vi.fn(fn => (completed = fn)) },
            onCommitted: { addListener: vi.fn(fn => (committed = fn)) }
        }
    })
    registerFrameTranslation()
})
afterEach(() => vi.unstubAllGlobals())

describe("on-demand frame translation", () => {
    it("drops an old sync if the top document navigates while frames are being enumerated", async () => {
        let release!: (value: typeof frames) => void
        vi.mocked(chrome.webNavigation.getAllFrames).mockImplementationOnce(
            () => new Promise(done => (release = done)) as never
        )
        const job = request("MEWCAT_FRAME_SYNC")
        await vi.waitFor(() => expect(release).toBeTypeOf("function"))
        committed({ tabId: 9, frameId: 0 })
        state = { ...state, sessionId: "new-page", enabled: false }
        release(frames)
        await job
        expect(executeScript).not.toHaveBeenCalled()
        expect(
            sendMessage.mock.calls.filter(
                ([, message]) => message.type === "MEWCAT_FRAME_APPLY"
            )
        ).toHaveLength(0)
    })
    it("does not send a stale enabled state after clear happens during injection", async () => {
        let release!: (value: never[]) => void
        executeScript.mockImplementationOnce(
            () => new Promise(done => (release = done))
        )
        const job = request("MEWCAT_FRAME_SYNC")
        await vi.waitFor(() => expect(release).toBeTypeOf("function"))
        state = { ...state, enabled: false, revision: 2 }
        release([])
        await job
        const applied = sendMessage.mock.calls.filter(
            ([, message]) => message.type === "MEWCAT_FRAME_APPLY"
        )
        expect(
            applied.every(([, message]) => message.state.enabled === false)
        ).toBe(true)
        expect(applied).toHaveLength(1)
    })
    it("injects into the cross-origin comment document and forwards the top-frame state", async () => {
        await request("MEWCAT_FRAME_SYNC")
        expect(executeScript).toHaveBeenCalledWith({
            target: { tabId: 9, documentIds: ["comments-1"] },
            files: ["/content-scripts/frame-translate.js"]
        })
        expect(executeScript).toHaveBeenCalledTimes(1)
        expect(sendMessage).toHaveBeenCalledWith(
            9,
            { type: "MEWCAT_FRAME_APPLY", state },
            { documentId: "comments-1" },
            expect.any(Function)
        )
    })
    it("handles delayed frames and navigation without reinjecting the same document", async () => {
        await request("MEWCAT_FRAME_SYNC")
        await completed({ tabId: 9, frameId: 2 })
        expect(executeScript).toHaveBeenCalledTimes(1)
        frames[1].documentId = "comments-2"
        await completed({ tabId: 9, frameId: 2 })
        expect(executeScript).toHaveBeenCalledTimes(2)
        removed(9)
        await completed({ tabId: 9, frameId: 2 })
        expect(executeScript).toHaveBeenCalledTimes(3)
    })
    it("clears existing frames without injecting when the page is disabled", async () => {
        state = { ...state, enabled: false, revision: 2 }
        await request("MEWCAT_FRAME_SYNC")
        expect(executeScript).not.toHaveBeenCalled()
        expect(sendMessage).toHaveBeenCalledWith(
            9,
            { type: "MEWCAT_FRAME_APPLY", state },
            { documentId: "comments-1" },
            expect.any(Function)
        )
    })
    it("gets authoritative state after worker restart and allows child reads only", async () => {
        expect(await request("MEWCAT_FRAME_GET", 2)).toEqual(state)
        await request("MEWCAT_FRAME_SYNC", 2)
        expect(executeScript).not.toHaveBeenCalled()
    })
    it("retries a failed injection and does not let it fail the main page", async () => {
        executeScript.mockRejectedValueOnce(new Error("Frame was removed"))
        expect(await request("MEWCAT_FRAME_SYNC")).toEqual({ success: true })
        await request("MEWCAT_FRAME_SYNC")
        expect(executeScript).toHaveBeenCalledTimes(2)
    })
    it("does not inject when the top frame has no valid translation session", async () => {
        state = { enabled: true }
        await completed({ tabId: 9, frameId: 2 })
        expect(executeScript).not.toHaveBeenCalled()
    })
    it("invalidates remembered injections when the top document navigates", async () => {
        await request("MEWCAT_FRAME_SYNC")
        committed({ tabId: 9, frameId: 0 })
        await request("MEWCAT_FRAME_SYNC")
        expect(executeScript).toHaveBeenCalledTimes(2)
    })
})
