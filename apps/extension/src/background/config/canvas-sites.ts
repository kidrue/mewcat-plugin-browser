const ENABLE_CANVAS_REBUILD =
    (import.meta.env.WXT_ENABLE_CANVAS_REBUILD || "true") !== "false"

const GLOBAL_CANVAS_ROLLOUT_PERCENT = Number(
    import.meta.env.WXT_CANVAS_ROLLOUT_PERCENT || "100"
)

type CanvasSiteRule = {
    key: string
    pattern: RegExp
    rolloutPercent: number
}

/* cspell:disable */
const CANVAS_SITE_RULES: CanvasSiteRule[] = [
    {
        key: "shonenjumpplus",
        pattern: /(^|\.)shonenjumpplus\.com$/i,
        rolloutPercent: 100
    },
    {
        key: "comic-growl",
        pattern: /(^|\.)comic-growl\.com$/i,
        rolloutPercent: 100
    },
    {
        key: "championcross",
        pattern: /(^|\.)championcross\.jp$/i,
        rolloutPercent: 100
    }
]
/* cspell:enable */

export interface CanvasRolloutDecision {
    enabled: boolean
    reason:
        | "disabled-by-env"
        | "invalid-host"
        | "site-not-supported"
        | "not-in-rollout-bucket"
        | "enabled"
    host?: string
    siteKey?: string
    bucketPercent?: number
    rolloutPercent?: number
}

function clampPercent(value: number): number {
    if (Number.isNaN(value)) {
        return 0
    }
    if (value < 0) {
        return 0
    }
    if (value > 100) {
        return 100
    }
    return Math.floor(value)
}

function getHostname(url?: string): string | null {
    if (!url) {
        return null
    }
    try {
        return new URL(url).hostname.toLowerCase()
    } catch {
        return null
    }
}

function hashString(input: string): number {
    let hash = 0
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash * 31 + input.charCodeAt(i)) % 100_000
    }
    return hash
}

function getStableBucketPercent(hostname: string): number {
    return hashString(hostname) % 100
}

function resolveSiteRule(hostname: string): CanvasSiteRule | null {
    return CANVAS_SITE_RULES.find(rule => rule.pattern.test(hostname)) || null
}

export function getCanvasRolloutDecision(
    pageUrl?: string
): CanvasRolloutDecision {
    if (!ENABLE_CANVAS_REBUILD) {
        return {
            enabled: false,
            reason: "disabled-by-env"
        }
    }

    const hostname = getHostname(pageUrl)
    if (!hostname) {
        return {
            enabled: false,
            reason: "invalid-host"
        }
    }

    const siteRule = resolveSiteRule(hostname)
    if (!siteRule) {
        return {
            enabled: false,
            reason: "site-not-supported",
            host: hostname
        }
    }

    const rolloutPercent = Math.min(
        clampPercent(siteRule.rolloutPercent),
        clampPercent(GLOBAL_CANVAS_ROLLOUT_PERCENT)
    )
    const bucketPercent = getStableBucketPercent(hostname)

    if (bucketPercent >= rolloutPercent) {
        return {
            enabled: false,
            reason: "not-in-rollout-bucket",
            host: hostname,
            siteKey: siteRule.key,
            bucketPercent,
            rolloutPercent
        }
    }

    return {
        enabled: true,
        reason: "enabled",
        host: hostname,
        siteKey: siteRule.key,
        bucketPercent,
        rolloutPercent
    }
}

export function shouldEnableCanvasHook(pageUrl?: string): boolean {
    return getCanvasRolloutDecision(pageUrl).enabled
}

export function getCanvasHookConfig() {
    return {
        enabled: ENABLE_CANVAS_REBUILD,
        globalRolloutPercent: clampPercent(GLOBAL_CANVAS_ROLLOUT_PERCENT),
        rules: CANVAS_SITE_RULES.map(rule => ({
            key: rule.key,
            pattern: rule.pattern.source,
            rolloutPercent: clampPercent(rule.rolloutPercent)
        }))
    }
}
