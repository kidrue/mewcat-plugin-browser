// @vitest-environment jsdom
import * as Sentry from "@sentry/browser"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { BackgroundResponseError } from "../src/messaging/BackgroundResponseError"
import {
    captureExtensionException,
    flushSentry,
    initializeSentry
} from "../src/monitoring/sentry"

const stateSymbol = Symbol.for("mewcat.sentry.state")
beforeEach(() => {
    vi.stubGlobal("chrome", {
        runtime: {
            id: "test-extension",
            getURL: (path: string) =>
                `chrome-extension://test-extension/${path}`
        }
    })
    vi.spyOn(globalThis, "addEventListener")
})
afterEach(async () => {
    const state = (globalThis as Record<symbol, unknown>)[stateSymbol] as {
        client?: { close: (timeout: number) => PromiseLike<boolean> }
    }
    await state?.client?.close(0)
    for (const [name, listener] of vi.mocked(globalThis.addEventListener).mock
        .calls) {
        if (name === "error" || name === "unhandledrejection")
            globalThis.removeEventListener(name, listener)
    }
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
    delete (globalThis as Record<symbol, unknown>)[
        Symbol.for("mewcat.sentry.state")
    ]
    delete (globalThis as Record<symbol, unknown>)[
        Symbol.for("mewcat.sentry.initialized")
    ]
})
function setup() {
    const envelopes: unknown[] = []
    const options = {
        runtimeContext: "content" as const,
        enableReplay: true,
        env: {
            isProduction: true,
            dsn: "https://public@example.invalid/1",
            version: "1.0.1"
        },
        transport: vi.fn(() => ({
            send: async (envelope: unknown) => {
                envelopes.push(envelope)
                return { statusCode: 200 }
            },
            flush: async () => true
        }))
    }
    expect(initializeSentry(options)).toBe(true)
    return { envelopes, options }
}
it("does not report background-owned failures again but still reports local failures", async () => {
    const { envelopes } = setup()
    expect(
        captureExtensionException(
            new BackgroundResponseError("NO_TEXT", "No text"),
            {
                feature: "image-translation",
                operation: "translate"
            }
        )
    ).toBeUndefined()
    expect(
        captureExtensionException(
            new BackgroundResponseError("NETWORK_FAILURE", "Failed"),
            {
                feature: "page-summary",
                operation: "generate"
            }
        )
    ).toBeUndefined()
    captureExtensionException(new Error("Local rendering failed"), {
        feature: "image-translation",
        operation: "translate"
    })
    await flushSentry(2000)
    expect(envelopes).toHaveLength(1)
})
it("initializes the real client once and deduplicates the same exception", async () => {
    const { envelopes, options } = setup()
    expect(initializeSentry(options)).toBe(true)
    expect(options.transport).toHaveBeenCalledTimes(1)
    const error = new Error("Same extension exception")
    captureExtensionException(error, { feature: "runtime", operation: "first" })
    captureExtensionException(error, {
        feature: "runtime",
        operation: "second"
    })
    await flushSentry(2000)
    expect(envelopes).toHaveLength(1)
})
it("captures extension errors without collecting unrelated host-page errors", async () => {
    const { envelopes } = setup()
    window.dispatchEvent(
        new ErrorEvent("error", {
            error: new Error("Host page failure"),
            filename: "https://example.com/app.js"
        })
    )
    const ownError = new Error("Extension failure")
    ownError.stack =
        "Error: Extension failure\n    at translate (chrome-extension://test-extension/content.js:1:1)"
    window.dispatchEvent(
        new ErrorEvent("error", {
            error: ownError,
            filename: "chrome-extension://test-extension/content.js"
        })
    )
    await flushSentry(2000)
    expect(envelopes).toHaveLength(1)
})
it("sends operation tags and sanitized context on the isolated scope", async () => {
    const { envelopes } = setup()
    captureExtensionException(new Error("Synthetic failure"), {
        feature: "page-translation",
        operation: "translate",
        errorCode: "NETWORK_FAILURE",
        status: 503,
        pageUrl: "https://example.com/article"
    })
    await flushSentry(2000)
    const event = (
        envelopes[0] as [unknown, Array<[unknown, Sentry.Event]>]
    )[1][0][1]
    expect(event.tags).toMatchObject({
        runtime_context: "content",
        feature: "page-translation",
        operation: "translate",
        error_code: "NETWORK_FAILURE",
        http_status: 503
    })
    expect(event.contexts?.page).toEqual({ url: "https://example.com/article" })
})
it("sends through the real SDK in a content script without binding a global client", async () => {
    vi.stubGlobal("chrome", {
        runtime: {
            id: "test-extension",
            getURL: (path: string) =>
                `chrome-extension://test-extension/${path}`
        }
    })
    const envelopes: unknown[] = []
    const globalClient = Sentry.getClient()
    const transport = () => ({
        send: async (envelope: unknown) => {
            envelopes.push(envelope)
            return { statusCode: 200 }
        },
        flush: async () => true
    })
    const enabled = initializeSentry({
        runtimeContext: "content",
        enableReplay: false,
        env: {
            isProduction: true,
            dsn: "https://public@example.invalid/1",
            version: "1.0.1"
        },
        transport
    })
    expect(enabled).toBe(true)
    const eventId = captureExtensionException(
        new Error("Synthetic extension failure"),
        { feature: "page-translation", operation: "sdk-regression" }
    )
    expect(eventId).toMatch(/^[a-f0-9]{32}$/)
    await flushSentry(2000)
    expect(envelopes).toHaveLength(1)
    expect(Sentry.getClient()).toBe(globalClient)
})
