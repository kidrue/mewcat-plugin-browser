import { useAsyncRetry } from "react-use"

import "@/styles/popup.scss"
import "@/styles/theme.scss"

import SettingsPanel from "../components/SettingsPanel"

// popup 与悬浮球共用设置逻辑，embedded 变体提供插画背景。
function IndexPopup() {
    const { value: currentTabUrl } = useAsyncRetry<URL>(() => {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                const currentTab = tabs[0]
                if (currentTab) {
                    const url = currentTab.url
                    return resolve(new URL(url))
                }
                reject(new Error("无法获取当前标签页"))
            })
        })
    }, [])

    return <SettingsPanel currentTabUrl={currentTabUrl} variant="embedded" />
}

export default IndexPopup
