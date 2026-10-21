import type { Breadcrumb, Event } from "@sentry/browser"

// cspell:ignore orization sntrys
const FILTERED = "[Filtered]"
const SECRET_KEY =
    /^(?:api[-_]?key|access[-_]?token|refresh[-_]?token|auth(?:orization)?|cookie|set-cookie|password|secret|session|prompt|image|(?:request|response)[-_]?(?:body|data)|selected[-_]?text)$/i
const SECRET_VALUE = [
    /Bearer\s+[^\s"']+/gi,
    /sntrys_[A-Za-z0-9_/-]+/gi,
    /\bsk-[A-Za-z0-9_-]{8,}\b/g,
    /\b(?:eyJ[A-Za-z0-9_-]+\.){2}[A-Za-z0-9_-]+\b/g
]
const PRIVATE_MESSAGE =
    /(?:prompt|messages|content|input|output|translation|原文|译文)\s*[=:：]/i

function filterString(value: string): string {
    return SECRET_VALUE.reduce(
        (current, pattern) =>
            current.replace(pattern, match =>
                match.startsWith("Bearer ") ? `Bearer ${FILTERED}` : FILTERED
            ),
        value
    )
}

export function sanitizeSentryValue(value: unknown, key = ""): unknown {
    if (SECRET_KEY.test(key)) {
        return FILTERED
    }
    if (typeof value === "string") {
        return filterString(value)
    }
    if (Array.isArray(value)) {
        return value.map(item => sanitizeSentryValue(item))
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([childKey, childValue]) => [
                childKey,
                sanitizeSentryValue(childValue, childKey)
            ])
        )
    }
    return value
}

export function sanitizeSentryEvent<T extends Event>(event: T): T {
    const sanitized = sanitizeSentryValue(event) as T
    const sanitizeMessage = (message: string | undefined) =>
        message && (message.length > 500 || PRIVATE_MESSAGE.test(message))
            ? FILTERED
            : message
    sanitized.message = sanitizeMessage(sanitized.message)
    for (const exception of sanitized.exception?.values || []) {
        exception.value = sanitizeMessage(exception.value)
    }
    delete sanitized.user
    delete sanitized.extra
    delete sanitized.request?.data
    if (sanitized.request?.headers) {
        sanitized.request.headers = Object.fromEntries(
            Object.entries(sanitized.request.headers).filter(
                ([key]) => !SECRET_KEY.test(key)
            )
        )
    }
    if (event.request?.url && sanitized.request) {
        sanitized.request.url = event.request.url
    }
    return sanitized
}

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    if (breadcrumb.category === "console") {
        return null
    }
    const data = breadcrumb.data
    const allowedData = data
        ? Object.fromEntries(
              Object.entries(data)
                  .filter(([key]) =>
                      ["url", "method", "status_code", "duration"].includes(key)
                  )
                  .map(([key, value]) => [
                      key,
                      key === "url" ? value : sanitizeSentryValue(value, key)
                  ])
          )
        : undefined
    return {
        category: breadcrumb.category,
        type: breadcrumb.type,
        level: breadcrumb.level,
        timestamp: breadcrumb.timestamp,
        ...(allowedData ? { data: allowedData } : {}),
        ...(breadcrumb.category?.startsWith("ui.")
            ? {}
            : { message: sanitizeSentryValue(breadcrumb.message) as string })
    }
}
