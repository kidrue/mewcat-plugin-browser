import type { ExtensionConfig } from "@/types/config"

export type PageAction = "status" | "start" | "clear" | "retry" | "source"
export interface PageActionRequest {
    type: "MEWCAT_PAGE_ACTION"
    action: PageAction
    sourceLanguage?: string
    pageUrl?: string
}
export interface ReadingState {
    status: "idle" | "translating" | "complete" | "partial" | "unavailable"
    translated: number
    failed: number
    sourceLanguage?: string
    reason?: string
}
export type PageActionExecutor = (
    request: PageActionRequest
) => Promise<ReadingState>

export function readingStatus(
    active: boolean,
    busy: boolean,
    translated: number,
    failed: number
): ReadingState {
    let status: ReadingState["status"] = "idle"
    if (active) {
        status = "complete"
        if (failed) status = "partial"
        if (busy) status = "translating"
    }
    return {
        status,
        translated,
        failed
    }
}

export function websiteRulePatch(
    config: Pick<ExtensionConfig, "alwaysTranslateUrls" | "neverTranslateUrls">,
    hostname: string,
    rule: string
) {
    const alwaysTranslateUrls = (config.alwaysTranslateUrls ?? []).filter(
        site => site !== hostname
    )
    const neverTranslateUrls = (config.neverTranslateUrls ?? []).filter(
        site => site !== hostname
    )
    if (rule === "always") alwaysTranslateUrls.push(hostname)
    if (rule === "never") neverTranslateUrls.push(hostname)
    return { alwaysTranslateUrls, neverTranslateUrls }
}

export function openReadingSettings(
    section: "translation" | "image" | "basic" = "translation"
) {
    chrome.runtime.sendMessage({ type: "OPEN_OPTIONS", section }, () => {
        void chrome.runtime.lastError
    })
}

export function executeTabAction(
    tabId: number,
    request: PageActionRequest
): Promise<ReadingState> {
    return new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, request, { frameId: 0 }, response => {
            const error = chrome.runtime.lastError
            resolve(
                error || !response
                    ? {
                          status: "unavailable",
                          translated: 0,
                          failed: 0,
                          reason: "此页面暂不可翻译。浏览器内部页不支持；普通网页请刷新后重试。"
                      }
                    : response
            )
        })
    })
}
