import { describe, expect, it } from "vitest"

import { createSentryRuntimeConfig } from "@/monitoring/config"
import { captureExtensionException, initializeSentry } from "@/monitoring/sentry"
import {
    sanitizeBreadcrumb,
    sanitizeSentryEvent,
    sanitizeSentryValue
} from "@/monitoring/sanitize"

describe("Sentry monitoring privacy and configuration", () => {
    it("only enables production monitoring with a DSN and labels the runtime", () => {
        const input = {
            dsn: "https://public@example.ingest.sentry.io/1",
            isProduction: true,
            runtimeContext: "content" as const,
            enableReplay: true,
            version: "0.0.5"
        }
        expect(createSentryRuntimeConfig(input)).toMatchObject({
            enabled: true,
            release: "mewcat@0.0.5",
            environment: "production",
            sendDefaultPii: false,
            sampleRate: 1,
            tracesSampleRate: 0,
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 1,
            tags: { runtime_context: "content", extension_version: "0.0.5" }
        })
        expect(createSentryRuntimeConfig({ ...input, isProduction: false }).enabled).toBe(false)
        expect(createSentryRuntimeConfig({ ...input, dsn: "" }).enabled).toBe(false)
        expect(createSentryRuntimeConfig({ ...input, runtimeContext: "background", enableReplay: false }).replaysOnErrorSampleRate).toBeUndefined()
    })

    it("filters credential-shaped keys and values recursively", () => {
        expect(
            sanitizeSentryValue({
                apiKey: "sk-secret",
                nested: {
                    authorization: "Bearer abc.def",
                    status: 500,
                    text: "Bearer abc.def"
                },
                items: [{ refreshToken: "secret" }]
            })
        ).toEqual({
            apiKey: "[Filtered]",
            nested: {
                authorization: "[Filtered]",
                status: 500,
                text: "Bearer [Filtered]"
            },
            items: [{ refreshToken: "[Filtered]" }]
        })
    })

    it("keeps full page URLs while dropping user and request bodies", () => {
        const event = sanitizeSentryEvent({
            request: {
                url: "https://example.com/private?q=kept#fragment",
                data: "private body",
                headers: { Authorization: "Bearer secret", Accept: "application/json" }
            },
            user: { id: "user" },
            extra: { selectedText: "private text" }
        } as never)
        expect(event.request).toEqual({
            url: "https://example.com/private?q=kept#fragment",
            headers: { Accept: "application/json" }
        })
        expect(event.user).toBeUndefined()
        expect(event.extra).toBeUndefined()
    })

    it("does not forward console breadcrumbs that can contain translated text", () => {
        expect(sanitizeBreadcrumb({ category: "console", message: "secret" })).toBeNull()
        expect(
            sanitizeBreadcrumb({
                category: "fetch",
                data: { url: "https://example.com/a?q=kept", request_body: "secret", status_code: 500 }
            })
        ).toEqual({
            category: "fetch",
            data: { url: "https://example.com/a?q=kept", status_code: 500 }
        })
    })

    it("removes prompt-like exception messages while keeping stack frames", () => {
        const event = sanitizeSentryEvent({
            message: "prompt: confidential text",
            exception: {
                values: [{ value: "content: confidential text", stacktrace: { frames: [{ filename: "chrome-extension://test/content.js", lineno: 3 }] } }]
            }
        } as never)
        expect(event.message).toBe("[Filtered]")
        expect(event.exception?.values?.[0]?.value).toBe("[Filtered]")
        expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.lineno).toBe(3)
    })
})

describe("Sentry runtime", () => {
    it("initializes once with masked Replay and never enables Replay in background", () => {
        const calls: unknown[] = []
        const adapter = {
            init: (options: unknown) => calls.push(options),
            replayIntegration: (options: unknown) => ({ name: "Replay", options }),
            captureException: () => "event-id",
            withScope: (callback: (scope: unknown) => void) =>
                callback({ setTag() {}, setContext() {} }),
            flush: async () => true
        }
        const input = {
            runtimeContext: "content" as const,
            enableReplay: true,
            env: {
                isProduction: true,
                dsn: "https://public@example.ingest.sentry.io/1",
                version: "0.0.5"
            },
            adapter
        }
        expect(initializeSentry(input)).toBe(true)
        expect(initializeSentry(input)).toBe(true)
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({
            integrations: [
                {
                    name: "Replay",
                    options: {
                        maskAllText: true,
                        maskAllInputs: true,
                        blockAllMedia: true
                    }
                }
            ]
        })
    })

    it("reports only fixed context fields with the original page URL", () => {
        const tags: Record<string, string> = {}
        const contexts: Record<string, unknown> = {}
        const adapter = {
            init() {},
            replayIntegration: () => ({ name: "Replay" }),
            captureException: () => "event-id",
            withScope: (callback: (scope: unknown) => void) =>
                callback({
                    setTag: (key: string, value: string) => (tags[key] = value),
                    setContext: (key: string, value: unknown) =>
                        (contexts[key] = value)
                }),
            flush: async () => true
        }
        initializeSentry({
            runtimeContext: "background",
            enableReplay: false,
            env: {
                isProduction: true,
                dsn: "https://public@example.ingest.sentry.io/1",
                version: "0.0.5"
            },
            adapter
        })
        expect(
            captureExtensionException(new Error("test"), {
                feature: "page-translation",
                operation: "translate",
                pageUrl: "https://example.com/a?q=keep#hash"
            }, adapter)
        ).toBe("event-id")
        expect(tags).toEqual({
            feature: "page-translation",
            operation: "translate"
        })
        expect(contexts).toEqual({
            page: { url: "https://example.com/a?q=keep#hash" }
        })
    })
})
