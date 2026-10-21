export interface SummaryActionResult {
    success: boolean
    message: string
    needsConfiguration?: boolean
}

export function summarizeCurrentPage(): Promise<SummaryActionResult> {
    return new Promise(resolve => {
        chrome.runtime.sendMessage(
            { type: "SUMMARIZE_PAGE" },
            (result?: SummaryActionResult) => {
                const error = chrome.runtime.lastError
                resolve(
                    error || !result
                        ? {
                              success: false,
                              message: "无法连接当前页，请刷新普通网页后重试。"
                          }
                        : result
                )
            }
        )
    })
}
