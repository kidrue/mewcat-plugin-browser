import { defineContentScript } from "#imports"

import { defaultExtensionConfig } from "@/state/constants"
import { createTranslationServiceStorageAdapter } from "@/state/translationService"
import { chromeStorageAdapter } from "@/state/util"
import { createFrameTranslationRuntime } from "@/translation/frameTranslationRuntime"
import { ImmersiveTranslator } from "@/translation/ImmersiveTranslator"

export default defineContentScript({
    matches: ["<all_urls>"],
    registration: "runtime",
    main(ctx) {
        if (window === window.top) return
        const frameWindow = window as Window & {
            __mewcatFrameTranslationCleanup?: () => void
        }
        if (frameWindow.__mewcatFrameTranslationCleanup) return
        const adapter =
            createTranslationServiceStorageAdapter(chromeStorageAdapter)
        const runtime = createFrameTranslationRuntime(
            () => adapter.getItem("extension-config", defaultExtensionConfig),
            config =>
                new ImmersiveTranslator({
                    ...config,
                    prioritizeVisibleArea: true
                })
        )
        const apply = (state: unknown) => {
            void runtime.applyState(state).catch(() => {
                // 子框架移除或加载失败不影响正文；不输出页面内容或凭据。
            })
        }
        const listener = (
            message: { type?: string; state?: unknown },
            sender: chrome.runtime.MessageSender
        ) => {
            if (
                sender.id === chrome.runtime.id &&
                message?.type === "MEWCAT_FRAME_APPLY"
            )
                apply(message.state)
        }
        const dispose = () => {
            runtime.dispose()
            chrome.runtime.onMessage.removeListener(listener)
            window.removeEventListener("pagehide", dispose)
            delete frameWindow.__mewcatFrameTranslationCleanup
        }
        frameWindow.__mewcatFrameTranslationCleanup = dispose
        ctx.onInvalidated(dispose)
        window.addEventListener("pagehide", dispose, { once: true })
        chrome.runtime.onMessage.addListener(listener)
        chrome.runtime.sendMessage({ type: "MEWCAT_FRAME_GET" }, state => {
            if (!chrome.runtime.lastError) apply(state)
        })
    }
})
