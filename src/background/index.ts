import { onMessage } from "@/messaging"

import { handleCanvasHookEvent } from "./messages/canvas-hook-event"
import { handleInjectMainWorldHook } from "./messages/inject-main-world-hook"
import { handleStructuredTranslateImage } from "./messages/structured-image-translation"
import { handleTranslateImage } from "./messages/translate-image"
import { handleTranslateRequest } from "./messages/translate-request"

const CONTEXT_MENU_ID = "immersive-translate"

function safeSendMessage(tabId: number, payload: unknown) {
    chrome.tabs.sendMessage(tabId, payload, () => {
        if (chrome.runtime.lastError) {
            // Ignore tabs without our content script (chrome:// pages, unloaded frames, etc.).
            return
        }
    })
}

async function handleToggleImmersiveTranslate(tabId: number) {
    try {
        chrome.tabs.sendMessage(
            tabId,
            { type: "TOGGLE_IMMERSIVE_TRANSLATE" },
            response => {
                if (chrome.runtime.lastError) {
                    return
                }
                if (response && typeof response.isTranslate === "boolean") {
                    chrome.contextMenus.update(CONTEXT_MENU_ID, {
                        title: response.isTranslate ? "开启翻译" : "关闭翻译"
                    })
                }
            }
        )
    } catch (error) {
        console.error("切换沉浸式翻译失败:", error)
    }
}

export function registerExtensionMessages(register = onMessage) {
    register("canvas-hook-event", message =>
        handleCanvasHookEvent(message.data)
    )
    register("inject-main-world-hook", message =>
        handleInjectMainWorldHook(
            message.data,
            message.sender as chrome.runtime.MessageSender
        )
    )
    register("translate-image", message =>
        handleStructuredTranslateImage(
            message.data,
            message.sender as chrome.runtime.MessageSender
        )
    )
    register("translate-image-legacy", message =>
        handleTranslateImage(
            message.data,
            message.sender as chrome.runtime.MessageSender
        )
    )
    register("translate-request", message =>
        handleTranslateRequest(message.data)
    )
}

export function registerBackgroundListeners() {
    registerExtensionMessages()

    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID,
            title: "开始翻译",
            contexts: ["page"]
        })
    })

    chrome.contextMenus.onClicked.addListener(async (_info, tab) => {
        if (!tab?.id) {
            return
        }

        try {
            await handleToggleImmersiveTranslate(tab.id)
        } catch (error) {
            console.error("右键菜单处理失败:", error)
        }
    })

    chrome.tabs.onActivated.addListener(tabInfo => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            const currentTab = tabs[0]
            if (currentTab) {
                safeSendMessage(tabInfo.tabId, {
                    type: "TOGGLE_ACTIVATED",
                    tabId: tabInfo.tabId,
                    url: currentTab.url
                })
            }

            chrome.tabs.sendMessage(
                tabInfo.tabId,
                { type: "GET_TRANSLATE_STATE" },
                response => {
                    if (chrome.runtime.lastError) {
                        return
                    }
                    if (response && typeof response.isTranslate === "boolean") {
                        chrome.contextMenus.update(CONTEXT_MENU_ID, {
                            title: response.isTranslate
                                ? "关闭翻译"
                                : "开启翻译"
                        })
                    }
                }
            )
        })
    })

    chrome.runtime.onMessage.addListener(
        (message: { type: string; isTranslate: boolean }) => {
            if (message.type === "TRANSLATE_END") {
                chrome.contextMenus.update(CONTEXT_MENU_ID, {
                    title: message.isTranslate ? "关闭翻译" : "开启翻译"
                })
            }
        }
    )

    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        safeSendMessage(tabId, {
            type: "TAB_UPDATED",
            tabId,
            url: changeInfo.url
        })
    })
}
