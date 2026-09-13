import * as Sentry from "@sentry/browser"

import { createSentryRuntimeConfig } from "./config"
import { sanitizeBreadcrumb, sanitizeSentryEvent } from "./sanitize"
import type { CaptureContext, RuntimeContext } from "./types"

type SentryAdapter = Pick<
    typeof Sentry,
    "init" | "replayIntegration" | "captureException" | "withScope" | "flush"
>

interface InitializeSentryOptions {
    runtimeContext: RuntimeContext
    enableReplay: boolean
    pageUrl?: string
    env?: { isProduction: boolean; dsn: string; version: string }
    adapter?: SentryAdapter
}

const initializedAdapters = new WeakSet<object>()
const initializationKey = Symbol.for("mewcat.sentry.initialized")

function isInitialized(adapter: SentryAdapter): boolean {
    return (
        initializedAdapters.has(adapter) ||
        (adapter === Sentry &&
            Boolean(
                (globalThis as typeof globalThis & Record<symbol, boolean>)[
                    initializationKey
                ]
            ))
    )
}

function getRuntimeEnvironment() {
    return {
        isProduction: import.meta.env.PROD,
        dsn: import.meta.env.WXT_SENTRY_DSN || "",
        version: chrome.runtime.getManifest().version
    }
}

export function initializeSentry(options: InitializeSentryOptions): boolean {
    const adapter = options.adapter || Sentry
    const env = options.env || getRuntimeEnvironment()
    const config = createSentryRuntimeConfig({
        ...env,
        runtimeContext: options.runtimeContext,
        enableReplay: options.enableReplay
    })
    if (!config.enabled) {
        return false
    }
    if (isInitialized(adapter)) {
        return true
    }
    try {
        adapter.init({
            ...config,
            integrations: options.enableReplay
                ? [
                      adapter.replayIntegration({
                          maskAllText: true,
                          maskAllInputs: true,
                          blockAllMedia: true
                      })
                  ]
                : [],
            beforeSend: event => sanitizeSentryEvent(event),
            beforeBreadcrumb: breadcrumb => sanitizeBreadcrumb(breadcrumb)
        })
        initializedAdapters.add(adapter)
        if (adapter === Sentry) {
            ;(globalThis as typeof globalThis & Record<symbol, boolean>)[
                initializationKey
            ] = true
        }
        return true
    } catch {
        return false
    }
}

export function captureExtensionException(
    error: unknown,
    context: CaptureContext,
    adapter: SentryAdapter = Sentry
): string | undefined {
    if (!isInitialized(adapter)) {
        return undefined
    }
    try {
        let eventId: string | undefined
        adapter.withScope(scope => {
            scope.setTag("feature", context.feature)
            scope.setTag("operation", context.operation)
            if (context.pageUrl) {
                scope.setContext("page", { url: context.pageUrl })
            }
            eventId = adapter.captureException(error)
        })
        return eventId
    } catch {
        return undefined
    }
}

export async function flushSentry(timeout = 1000): Promise<boolean> {
    if (!isInitialized(Sentry)) {
        return false
    }
    try {
        return await Sentry.flush(timeout)
    } catch {
        return false
    }
}
