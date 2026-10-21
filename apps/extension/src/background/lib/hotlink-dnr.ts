import type { HotlinkHeaders } from "../config/hotlink-sites"

export const DNR_RULE_ID_BASE = 900_000
export const DNR_RULE_ID_MAX = 999_999
const DNR_RULE_INSTALL_DELAY_MS = 80

let nextDynamicRuleId = DNR_RULE_ID_BASE
let staleRuleCleanupPromise: Promise<void> | null = null

function allocateDynamicRuleId(): number {
    const ruleId = nextDynamicRuleId
    nextDynamicRuleId += 1
    if (nextDynamicRuleId > DNR_RULE_ID_MAX) {
        nextDynamicRuleId = DNR_RULE_ID_BASE
    }
    return ruleId
}

function buildDynamicRule(
    imageUrl: string,
    headers: HotlinkHeaders,
    ruleId: number
): chrome.declarativeNetRequest.Rule {
    const hostname = new URL(imageUrl).hostname
    const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
        {
            header: "referer",
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
            value: headers.referer
        }
    ]

    if (headers.origin) {
        requestHeaders.push({
            header: "origin",
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
            value: headers.origin
        })
    }

    return {
        id: ruleId,
        priority: 1,
        action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders
        },
        condition: {
            // Host-level match is intentional for compatibility with wildcard site rules.
            // If multiple concurrent downloads hit the same host, temporary rules may overlap.
            urlFilter: `||${hostname}^`,
            resourceTypes: [
                chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
                chrome.declarativeNetRequest.ResourceType.IMAGE,
                chrome.declarativeNetRequest.ResourceType.OTHER
            ],
            initiatorDomains: [chrome.runtime.id]
        }
    }
}

async function addDynamicRule(
    rule: chrome.declarativeNetRequest.Rule
): Promise<void> {
    await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [rule],
        removeRuleIds: [rule.id]
    })
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function clearStaleHotlinkDynamicRules(): Promise<void> {
    if (!chrome.declarativeNetRequest?.getDynamicRules) {
        return
    }

    const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules()
    const staleRuleIds = dynamicRules
        .filter(
            rule => rule.id >= DNR_RULE_ID_BASE && rule.id <= DNR_RULE_ID_MAX
        )
        .map(rule => rule.id)

    if (!staleRuleIds.length) {
        return
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: staleRuleIds
    })
}

function ensureStaleRuleCleanup(): Promise<void> {
    if (!staleRuleCleanupPromise) {
        staleRuleCleanupPromise = clearStaleHotlinkDynamicRules().catch(
            error => {
                console.warn(
                    "[TranslateImage] 清理残留 DNR 动态规则失败:",
                    error
                )
            }
        )
    }
    return staleRuleCleanupPromise
}

async function removeDynamicRule(ruleId: number): Promise<void> {
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [ruleId]
    })
}

export async function withTemporaryHotlinkRule<T>(
    imageUrl: string,
    headers: HotlinkHeaders,
    runner: () => Promise<T>
): Promise<T> {
    if (!chrome.declarativeNetRequest?.updateDynamicRules) {
        return runner()
    }

    await ensureStaleRuleCleanup()

    const ruleId = allocateDynamicRuleId()
    const rule = buildDynamicRule(imageUrl, headers, ruleId)

    await addDynamicRule(rule)
    await wait(DNR_RULE_INSTALL_DELAY_MS)
    try {
        return await runner()
    } finally {
        await removeDynamicRule(ruleId).catch(error => {
            console.warn("[TranslateImage] 清理 DNR 动态规则失败:", {
                ruleId,
                error
            })
        })
    }
}
