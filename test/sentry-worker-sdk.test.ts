import { expect, it } from "vitest"

import {
    captureExtensionException,
    flushSentry,
    initializeSentry
} from "../src/monitoring/sentry"

it("sends with the real SDK without window or document in a service worker", async () => {
    const envelopes: unknown[] = []
    expect(
        initializeSentry({
            runtimeContext: "background",
            enableReplay: false,
            env: {
                isProduction: true,
                dsn: "https://public@example.invalid/1",
                version: "1.0.1"
            },
            transport: () => ({
                send: async envelope => {
                    envelopes.push(envelope)
                    return { statusCode: 200 }
                },
                flush: async () => true
            })
        })
    ).toBe(true)
    captureExtensionException(new Error("Synthetic worker failure"), {
        feature: "runtime",
        operation: "worker-regression"
    })
    await flushSentry(2000)
    expect(envelopes).toHaveLength(1)
})
