import { describe, expect, it } from "vitest"

import { createSentryRuntimeConfig } from "@/monitoring/config"
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
        expect(
            createSentryRuntimeConfig({ ...input, isProduction: false }).enabled
        ).toBe(false)
        expect(createSentryRuntimeConfig({ ...input, dsn: "" }).enabled).toBe(
            false
        )
        expect(
            createSentryRuntimeConfig({
                ...input,
                runtimeContext: "background",
                enableReplay: false
            }).replaysOnErrorSampleRate
        ).toBeUndefined()
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
                headers: {
                    Authorization: "Bearer secret",
                    Accept: "application/json"
                }
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
        expect(
            sanitizeBreadcrumb({ category: "console", message: "secret" })
        ).toBeNull()
        expect(
            sanitizeBreadcrumb({
                category: "fetch",
                data: {
                    url: "https://example.com/a?q=kept",
                    request_body: "secret",
                    status_code: 500
                }
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
                values: [
                    {
                        value: "content: confidential text",
                        stacktrace: {
                            frames: [
                                {
                                    filename:
                                        "chrome-extension://test/content.js",
                                    lineno: 3
                                }
                            ]
                        }
                    }
                ]
            }
        } as never)
        expect(event.message).toBe("[Filtered]")
        expect(event.exception?.values?.[0]?.value).toBe("[Filtered]")
        expect(
            event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.lineno
        ).toBe(3)
    })
})
