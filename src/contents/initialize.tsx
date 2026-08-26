import { franc } from "franc"
import { useSetAtom } from "jotai"
import React, { useEffect } from "react"
import { useAsyncRetry } from "react-use"

import { updateConfigAtom } from "../state"
import { getEnhancedLanguageCode } from "../utils/francLanguageMap"

export const getShadowHostId = () => "mewcat-overlay-init"

/***
 * 此组件负责初始化配置以及接受配置更新的消息并处理
 *
 */
const Initialize: React.FunctionComponent = () => {
    const updateConfig = useSetAtom(updateConfigAtom)
    // 加载网站时解析其语言
    const { retry } = useAsyncRetry(async () => {
        const htmlText = document.documentElement.innerText
        const detected = franc(htmlText)
        const normalizedLang = getEnhancedLanguageCode(detected, htmlText)
        if (normalizedLang && normalizedLang !== "und") {
            updateConfig({ detectedLanguage: normalizedLang })
        }
    }, [updateConfig])

    // 活动标签页切换时重新识别和语言
    useEffect(() => {
        const handleMessage = function (message: {
            type: string
            tabId?: string
            text?: string
        }) {
            if (message.type === "TOGGLE_ACTIVATED") {
                retry()
            }
        }
        chrome.runtime.onMessage.addListener(handleMessage)
        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage)
        }
    }, [retry])

    return (
        <div
            style={{
                position: "fixed",
                zIndex: 99,
                top: 0,
                right: 0,
                background: "#000",
                color: "#fff"
            }}
        >
            {/* {JSON.stringify(config)} */}
        </div>
    )
}

export default Initialize
