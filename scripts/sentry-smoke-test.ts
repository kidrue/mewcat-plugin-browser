/** Sends one synthetic error through the production monitoring code; never sends page/user data. */
import { makeFetchTransport } from "@sentry/browser"
import { loadEnv } from "vite"

import { withFailureCause } from "../src/background/lib/failure-cause"
import { monitorBackgroundHandler } from "../src/background/lib/monitor-background-handler"
import { flushSentry, initializeSentry } from "../src/monitoring/sentry"

const env = { ...loadEnv("production", process.cwd(), ""), ...process.env }
const dsn = env.WXT_SENTRY_DSN?.trim()
if (!dsn) throw new Error("WXT_SENTRY_DSN is required")
const { version } = await import("../package.json")
let accepted = false
let ingestStatus: number | undefined
let transportError: string | undefined
let eventId: string | undefined
const transport: NonNullable<
    Parameters<typeof initializeSentry>[0]["transport"]
> = options =>
    makeFetchTransport(options, async (url, request) => {
        try {
            if (typeof request.body === "string") {
                eventId = JSON.parse(request.body.split("\n")[0]).event_id
            }
            const response = await fetch(url, {
                ...request,
                signal: AbortSignal.timeout(15000)
            })
            ingestStatus = response.status
            accepted = response.ok
            return response
        } catch (error) {
            transportError =
                error instanceof Error ? error.name : "TransportError"
            throw error
        }
    })
const enabled = initializeSentry({
    runtimeContext: "background",
    enableReplay: false,
    env: { isProduction: true, dsn, version },
    transport
})
if (!enabled) throw new Error("Sentry initialization failed")
const syntheticError = new Error("mewCat synthetic Sentry delivery check")
syntheticError.stack = `${syntheticError.name}: ${syntheticError.message}\n    at sentrySmokeTest (chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/background.js:1:1)`
await monitorBackgroundHandler("sentry-smoke-test", async () =>
    withFailureCause(
        {
            success: false,
            error: { code: "NETWORK_FAILURE", message: "Synthetic test only" }
        },
        syntheticError
    )
)
const flushed = await flushSentry(20000)
console.log(
    JSON.stringify({
        eventId,
        release: `mewcat@${version}`,
        ingestStatus,
        transportError,
        accepted,
        flushed
    })
)
if (!eventId || !accepted || !flushed) process.exitCode = 1
