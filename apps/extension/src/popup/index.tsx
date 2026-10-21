import { useCallback, useMemo } from "react"
import { useAsyncRetry } from "react-use"

import { executeTabAction, type PageActionRequest } from "@/reading/pageActions"

import "@/styles/popup.scss"
import "@/styles/theme.scss"

import SettingsPanel from "../components/SettingsPanel"

// popup 与悬浮球共用设置逻辑，embedded 变体提供插画背景。
function IndexPopup() {
    const { value: currentTab } = useAsyncRetry(async () => {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        })
        return tab
    }, [])
    const currentTabUrl = useMemo(() => {
        try {
            return currentTab?.url ? new URL(currentTab.url) : undefined
        } catch {
            return undefined
        }
    }, [currentTab?.url])

    const execute = useCallback(
        async (request: PageActionRequest) => {
            const tab = currentTab
            if (!tab?.id || !tab.url || !/^https?:/.test(tab.url))
                return {
                    status: "unavailable" as const,
                    translated: 0,
                    failed: 0,
                    reason: "浏览器内部页等页面不支持翻译，请打开普通网页。"
                }
            return executeTabAction(tab.id, { ...request, pageUrl: tab.url })
        },
        [currentTab]
    )
    return (
        <SettingsPanel
            currentTabUrl={currentTabUrl}
            variant="embedded"
            executePageAction={execute}
        />
    )
}

export default IndexPopup
