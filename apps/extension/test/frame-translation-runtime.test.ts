// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import rules from "../src/public/assets/rule.json"
import { defaultExtensionConfig } from "../src/state/constants"
import { createFrameTranslationRuntime } from "../src/translation/frameTranslationRuntime"
import { ImmersiveTranslator } from "../src/translation/ImmersiveTranslator"

const service = vi.hoisted(() => ({ translate: vi.fn() }))
vi.mock("../src/translation/translationService", () => ({
    translateBatch: service.translate,
    hasAITranslationEnabled: () => false
}))
vi.mock("../src/utils/environment", async original => ({
    ...(await original<object>()),
    isDevelopment: () => false
}))
const state = {
    sessionId: "page-1",
    revision: 1,
    enabled: true,
    sourceLanguage: "en",
    manual: true
}
const config = {
    ...defaultExtensionConfig,
    cacheEnabled: false,
    enableViewportTranslation: false
}
let runtime: ReturnType<typeof createFrameTranslationRuntime>
beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML =
        '<div id="comments"><p>A useful comment about learning mathematics.</p></div>'
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
        .mockImplementation(async (_config, messages) =>
            messages.map(message => `译文 ${message.content}`).join("\n")
        )
    runtime = createFrameTranslationRuntime(
        async () => config,
        value => new ImmersiveTranslator(value)
    )
})
afterEach(() => {
    runtime.dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
describe("frame translation runtime", () => {
    it("uses the basic DOM rules for comments and translates late additions without UI", async () => {
        await runtime.applyState(state)
        await vi.advanceTimersByTimeAsync(100)
        expect(
            document.querySelector(".mewcat-container")?.textContent
        ).toContain("译文")
        expect(
            document.querySelector(".mewcat-container")?.textContent
        ).toContain("learning mathematics")
        document
            .querySelector("#comments")!
            .insertAdjacentHTML(
                "beforeend",
                "<p>Another reader added a detailed response.</p>"
            )
        await vi.advanceTimersByTimeAsync(200)
        expect(document.querySelectorAll(".mewcat-container")).toHaveLength(2)
        expect(document.querySelector("button,[id*=overlay]")).toBeNull()
        await runtime.applyState({ ...state, enabled: false, revision: 2 })
        expect(document.querySelector(".mewcat-container")).toBeNull()
    })
    it("keeps watching an empty frame until its asynchronous comments load", async () => {
        document.body.innerHTML = '<div id="comments"></div>'
        await runtime.applyState(state)
        document.querySelector("#comments")!.innerHTML =
            "<p>The comments have finished loading asynchronously.</p>"
        await vi.advanceTimersByTimeAsync(200)
        expect(
            document.querySelector(".mewcat-container")?.textContent
        ).toContain("finished loading")
    })
    it("does not restart for duplicate or stale versions", async () => {
        await runtime.applyState(state)
        await runtime.applyState({ ...state, enabled: false, revision: 2 })
        await runtime.applyState(state)
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate).toHaveBeenCalledTimes(1)
        expect(document.querySelector(".mewcat-container")).toBeNull()
    })
    it.each(["clear", "dispose"])(
        "cancels slow configuration on %s",
        async action => {
            let resolve!: (value: typeof config) => void
            const create = vi.fn(value => new ImmersiveTranslator(value))
            runtime.dispose()
            runtime = createFrameTranslationRuntime(
                () => new Promise(done => (resolve = done)),
                create
            )
            const pending = runtime.applyState(state)
            if (action === "clear")
                await runtime.applyState({
                    ...state,
                    enabled: false,
                    revision: 2
                })
            else runtime.dispose()
            resolve(config)
            await pending
            expect(create).not.toHaveBeenCalled()
            expect(service.translate).not.toHaveBeenCalled()
        }
    )
    it("does not start if the extension has been disabled", async () => {
        runtime.dispose()
        runtime = createFrameTranslationRuntime(
            async () => ({ ...config, extensionEnabled: false }),
            value => new ImmersiveTranslator(value)
        )
        await runtime.applyState(state)
        expect(service.translate).not.toHaveBeenCalled()
    })
    it("waits for asynchronous rule initialization and can cancel during that wait", async () => {
        let resolve!: (value: { json: () => Promise<typeof rules> }) => void
        vi.mocked(fetch).mockImplementationOnce(
            () => new Promise(done => (resolve = done)) as never
        )
        const pending = runtime.applyState(state)
        await Promise.resolve()
        await runtime.applyState({ ...state, enabled: false, revision: 2 })
        resolve({ json: async () => rules })
        await pending
        await vi.advanceTimersByTimeAsync(200)
        expect(service.translate).not.toHaveBeenCalled()
        expect(document.querySelector(".mewcat-container")).toBeNull()
    })
})
