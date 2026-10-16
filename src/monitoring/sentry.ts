import * as Sentry from "@sentry/browser"

import { BackgroundResponseError } from "@/messaging/BackgroundResponseError"

import { createSentryRuntimeConfig } from "./config"
import { sanitizeBreadcrumb, sanitizeSentryEvent } from "./sanitize"
import type { CaptureContext, RuntimeContext } from "./types"

interface InitializeSentryOptions {
    runtimeContext: RuntimeContext
    enableReplay: boolean
    pageUrl?: string
    env?: { isProduction: boolean; dsn: string; version: string }
    transport?: Sentry.BrowserOptions["transport"]
}

interface MonitoringState {
    client: NonNullable<ReturnType<typeof Sentry.init>>
    scope: Sentry.Scope
    reported: WeakSet<object>
}
const stateKey = Symbol.for("mewcat.sentry.state")
const runtimeGlobal = globalThis as typeof globalThis & {
    [stateKey]?: MonitoringState
}
const sharedEnvironmentIntegrations = new Set([
    "BrowserApiErrors",
    "BrowserSession",
    "Breadcrumbs",
    "ConversationId",
    "GlobalHandlers",
    "FunctionToString"
])

function registerGlobalErrors(runtimeContext: RuntimeContext): void {
    if (typeof globalThis.addEventListener !== "function") return
    const extensionOrigin = globalThis.chrome?.runtime?.getURL("")
    const belongsToExtension = (error: unknown, filename?: string) =>
        runtimeContext !== "content" ||
        Boolean(
            extensionOrigin &&
                (filename?.startsWith(extensionOrigin) ||
                    (error instanceof Error &&
                        error.stack?.includes(extensionOrigin)))
        )
    globalThis.addEventListener("error", (event: ErrorEvent) => {
        if (!belongsToExtension(event.error, event.filename)) return
        captureExtensionException(
            event.error ?? new Error("Uncaught extension runtime error"),
            { feature: "runtime", operation: "uncaught-error" }
        )
    })
    globalThis.addEventListener(
        "unhandledrejection",
        (event: PromiseRejectionEvent) => {
            if (!belongsToExtension(event.reason)) return
            captureExtensionException(event.reason, {
                feature: "runtime",
                operation: "unhandled-rejection"
            })
        }
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
    const env = options.env || getRuntimeEnvironment()
    const config = createSentryRuntimeConfig({
        ...env,
        runtimeContext: options.runtimeContext,
        enableReplay:
            options.enableReplay &&
            !["content", "background"].includes(options.runtimeContext)
    })
    if (!config.enabled) {
        return false
    }
    if (runtimeGlobal[stateKey])
        return runtimeGlobal[stateKey].client.getOptions().enabled !== false
    try {
        const isolated = ["content", "background"].includes(
            options.runtimeContext
        )
        const settings = {
            ...config,
            transport: options.transport ?? Sentry.makeFetchTransport,
            beforeSend: (event: Sentry.ErrorEvent) =>
                sanitizeSentryEvent(event),
            beforeBreadcrumb: (breadcrumb: Sentry.Breadcrumb) =>
                sanitizeBreadcrumb(breadcrumb)
        }
        const client = isolated
            ? new Sentry.BrowserClient({
                  ...settings,
                  stackParser: Sentry.defaultStackParser,
                  integrations: Sentry.getDefaultIntegrations({}).filter(
                      integration =>
                          !sharedEnvironmentIntegrations.has(integration.name)
                  )
              })
            : Sentry.init({
                  ...settings,
                  integrations: options.enableReplay
                      ? [
                            Sentry.replayIntegration({
                                maskAllText: true,
                                maskAllInputs: true,
                                blockAllMedia: true
                            })
                        ]
                      : []
              })
        if (
            !client ||
            client.getOptions().enabled === false ||
            !client.getDsn()
        )
            return false
        const scope = new Sentry.Scope()
        scope.setClient(client)
        scope.setTags(config.tags)
        if (options.pageUrl) scope.setContext("page", { url: options.pageUrl })
        const state = { client, scope, reported: new WeakSet<object>() }
        runtimeGlobal[stateKey] = state
        if (isolated) {
            client.init()
            registerGlobalErrors(options.runtimeContext)
        }
        return true
    } catch {
        delete runtimeGlobal[stateKey]
        return false
    }
}

export function captureExtensionException(
    error: unknown,
    context: CaptureContext
): string | undefined {
    if (error instanceof BackgroundResponseError) return undefined
    const state = runtimeGlobal[stateKey]
    if (!state) return undefined
    const object =
        typeof error === "object" && error !== null ? error : undefined
    if (object && state.reported.has(object)) return undefined
    try {
        const scope = state.scope.clone()
        scope.setTag("feature", context.feature)
        scope.setTag("operation", context.operation)
        if (context.errorCode) scope.setTag("error_code", context.errorCode)
        if (context.status !== undefined)
            scope.setTag("http_status", context.status)
        if (context.pageUrl) scope.setContext("page", { url: context.pageUrl })
        const eventId = scope.captureException(error)
        if (object) state.reported.add(object)
        return eventId
    } catch {
        return undefined
    }
}

export async function flushSentry(timeout = 1000): Promise<boolean> {
    const state = runtimeGlobal[stateKey]
    if (state) {
        try {
            return await state.client.flush(timeout)
        } catch {
            return false
        }
    }
    return false
}
