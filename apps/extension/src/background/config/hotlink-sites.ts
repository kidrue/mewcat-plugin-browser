import { GENERATED_HOTLINK_SITE_RULES } from "./hotlink-sites.generated"

export interface HotlinkHeaders {
    referer: string
    origin?: string
}

export interface ResolveHotlinkInput {
    imageUrl: string
    pageUrl?: string
}

export interface HotlinkCandidate extends HotlinkHeaders {
    ruleKey: string
    source: "manual" | "generated"
    priority: number
    pageHostAllowList?: string[]
}

interface HotlinkSiteRule extends HotlinkCandidate {
    matchHost: RegExp
    override?: boolean
}

interface CandidateRanked {
    candidate: HotlinkCandidate
    overrideRank: number
    pageSpecificRank: number
}

/* cspell:disable -- domain names */
const MANUAL_HOTLINK_SITE_RULES: HotlinkSiteRule[] = [
    {
        ruleKey: "manual-pximg",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /(^|\.)pximg\.net$/i,
        referer: "https://www.pixiv.net/"
    },
    {
        ruleKey: "manual-newtoki-wildcard",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^img1\.newtoki21.*\.org$/i,
        referer: "https://newtoki341.com/"
    },
    {
        ruleKey: "manual-blogspot",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^2\.bp\.blogspot\.com$/i,
        referer: "https://2.bp.blogspot.com"
    },
    {
        ruleKey: "manual-japanreader",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^japanreader\.com$/i,
        referer: "https://japanreader.com"
    },
    {
        ruleKey: "manual-mangafuna",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^sl\.mangafuna\.xyz$/i,
        referer: "https://sl.mangafuna.xyz/"
    },
    {
        ruleKey: "manual-toonily",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^s.*\.toonilycdnv2\.xyz$/i,
        referer: "https://toonily.me"
    },
    {
        ruleKey: "manual-whatsnew",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^.*\.whatsnew.*\.net$/i,
        referer: "https://readcomiconline.li"
    },
    {
        ruleKey: "manual-yymanhua",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^image\.yymanhua\.com$/i,
        referer: "https://yymanhua.com"
    },
    {
        ruleKey: "manual-klimv1-jfimv2",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^(.+\.)?(klimv1|jfimv2)\.xyz$/i,
        referer: "https://klz9.com"
    },
    {
        ruleKey: "manual-manhwato",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^stcdn\.manhwato\.com$/i,
        referer: "https://manhwato.com"
    },
    {
        ruleKey: "manual-kingwar",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^.*\.kingwar\.cn$/i,
        referer: "https://www.comemh8.com"
    },
    {
        ruleKey: "manual-sinaimg",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^.*\.sinaimg\.cn$/i,
        referer: "https://weibo.com/"
    },
    {
        ruleKey: "manual-championcross",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^viewer\.championcross\.jp$/i,
        referer: "https://viewer.championcross.jp"
    },
    {
        ruleKey: "manual-comic-growl",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^viewer\.comic-growl\.com$/i,
        referer: "https://viewer.comic-growl.com/"
    },
    {
        ruleKey: "manual-shonenjumpplus-cdn",
        source: "manual",
        priority: 1_000,
        override: true,
        matchHost: /^cdn-ak-img\.shonenjumpplus\.com$/i,
        referer: "https://shonenjumpplus.com/",
        pageHostAllowList: ["shonenjumpplus.com", "*.shonenjumpplus.com"]
    }
]
/* cspell:enable */

const GENERATED_HOTLINK_RULES: HotlinkSiteRule[] =
    GENERATED_HOTLINK_SITE_RULES.map(rule => ({
        ruleKey: rule.ruleKey,
        source: "generated",
        priority: rule.priority,
        matchHost: new RegExp(rule.matchHostPattern, "i"),
        referer: rule.referer,
        origin: rule.origin
    }))

const HOTLINK_SITE_RULES: HotlinkSiteRule[] = [
    ...MANUAL_HOTLINK_SITE_RULES,
    ...GENERATED_HOTLINK_RULES
]

function getHostname(url?: string): string | null {
    if (!url) {
        return null
    }
    try {
        return new URL(url).hostname
    } catch {
        return null
    }
}

function isPageHostAllowed(
    pageHost: string | null,
    allowList?: string[]
): boolean {
    if (!allowList?.length) {
        return true
    }
    if (!pageHost) {
        return false
    }

    return allowList.some(allowHost => {
        const normalizedAllowHost = allowHost.toLowerCase().trim()
        const normalizedPageHost = pageHost.toLowerCase()

        if (normalizedAllowHost.startsWith("*.")) {
            const suffix = normalizedAllowHost.slice(2)
            return (
                normalizedPageHost === suffix ||
                normalizedPageHost.endsWith(`.${suffix}`)
            )
        }
        return normalizedPageHost === normalizedAllowHost
    })
}

function normalizeResolveInput(
    input: ResolveHotlinkInput | string
): ResolveHotlinkInput {
    return typeof input === "string" ? { imageUrl: input } : input
}

export function resolveAllHotlinkHeaders(
    input: ResolveHotlinkInput | string
): HotlinkCandidate[] {
    const normalized = normalizeResolveInput(input)
    const imageHost = getHostname(normalized.imageUrl)
    const pageHost = getHostname(normalized.pageUrl)

    if (!imageHost) {
        return []
    }

    const rankedCandidates: CandidateRanked[] = []

    HOTLINK_SITE_RULES.forEach(rule => {
        if (!rule.matchHost.test(imageHost)) {
            return
        }

        const pageAllowed = isPageHostAllowed(pageHost, rule.pageHostAllowList)
        if (!pageAllowed) {
            return
        }

        rankedCandidates.push({
            candidate: {
                referer: rule.referer,
                origin: rule.origin,
                ruleKey: rule.ruleKey,
                source: rule.source,
                priority: rule.priority,
                pageHostAllowList: rule.pageHostAllowList
            },
            overrideRank: rule.override ? 0 : 1,
            pageSpecificRank: rule.pageHostAllowList?.length ? 0 : 1
        })
    })

    rankedCandidates.sort((left, right) => {
        if (left.overrideRank !== right.overrideRank) {
            return left.overrideRank - right.overrideRank
        }
        if (left.pageSpecificRank !== right.pageSpecificRank) {
            return left.pageSpecificRank - right.pageSpecificRank
        }
        if (left.candidate.priority !== right.candidate.priority) {
            return right.candidate.priority - left.candidate.priority
        }
        if (left.candidate.source !== right.candidate.source) {
            return left.candidate.source === "manual" ? -1 : 1
        }
        return left.candidate.ruleKey.localeCompare(right.candidate.ruleKey)
    })

    return rankedCandidates.map(item => item.candidate)
}

export function resolveHotlinkHeaders(
    imageUrl: string,
    pageUrl?: string
): HotlinkHeaders | null {
    const firstCandidate = resolveAllHotlinkHeaders({
        imageUrl,
        pageUrl
    })[0]

    if (!firstCandidate) {
        return null
    }

    return {
        referer: firstCandidate.referer,
        origin: firstCandidate.origin
    }
}
