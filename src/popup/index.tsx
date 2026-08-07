import { useAsyncRetry } from "react-use"

import "@/styles/popup.scss"
import "@/styles/theme.scss"

import SettingsPanel from "../components/SettingsPanel"

// popup 与悬浮球弹出的面板是同一份实现，只是不再叠一层纸面。
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
