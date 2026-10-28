/** 保持同步调用 sidePanel.open，保留来自网页点击的用户手势。 */
export function registerExtensionNavigation(): void {
    chrome.runtime.onMessage.addListener(
        (message: { type?: string; section?: string }, sender, respond) => {
            if (message.type === "OPEN_SIDE_PANEL") {
                const tabId = sender.tab?.id
                const fail = () =>
                    respond({
                        success: false,
                        message:
                            "无法打开侧边栏，请刷新网页后重试，或使用支持侧边栏的 Chrome 浏览器。"
                    })
                if (typeof tabId !== "number" || !chrome.sidePanel?.open) {
                    fail()
                    return
                }
                try {
                    chrome.sidePanel
                        .open({ tabId })
                        .then(() => respond({ success: true }), fail)
                    return true
                } catch {
                    fail()
                    return
                }
            }
            if (message.type === "OPEN_OPTIONS") {
                const section = ["translation", "image", "basic"].includes(
                    message.section ?? ""
                )
                    ? `#${message.section}`
                    : ""
                chrome.tabs.create(
                    { url: chrome.runtime.getURL("options.html") + section },
                    () => {
                        respond(
                            chrome.runtime.lastError
                                ? {
                                      success: false,
                                      message: "无法打开高级设置，请重试。"
                                  }
                                : { success: true }
                        )
                    }
                )
                return true
            }
        }
    )
}
