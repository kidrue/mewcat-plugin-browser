const MAX_CONTEXT_LENGTH = 2000

export function normalizeTranslationContext(
    context?: string
): string | undefined {
    const limited = context
        ?.trim()
        .slice(0, MAX_CONTEXT_LENGTH)
        .replace(/[\uD800-\uDBFF]$/u, "")
    return limited || undefined
}
