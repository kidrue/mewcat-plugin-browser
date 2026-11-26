import { useAtomValue } from "jotai"
import { useEffect, useState } from "react"

import { defineContentScript } from "#imports"

import { MonitoringErrorBoundary } from "@/components/MonitoringErrorBoundary"
import { PageSummaryController } from "@/features/page-summary/PageSummaryController"
import {
    DEFAULT_PAGE_SUMMARY_SHORTCUT,
    installPageSummaryShortcut
} from "@/features/page-summary/pageSummaryShortcut"
import { configAtom } from "@/state"
import { registerUiFonts } from "@/utils/fonts"
import { Toast, ToastType } from "@/utils/toast"

export default defineContentScript({
    matches: ["<all_urls>"],
    runAt: "document_idle",
    async main() {
        registerUiFonts()
        const container = document.createElement("div")
        document.documentElement.append(container)
        const { createRoot } = await import("react-dom/client")
        createRoot(container).render(
            <MonitoringErrorBoundary
                feature="page-summary"
                operation="render"
                fallbackRender={() => null}
            >
                <PageSummaryApp />
            </MonitoringErrorBoundary>
        )
    }
})

export const PageSummaryApp: React.FC = () => {
    const config = useAtomValue(configAtom)

    const [controller] = useState(() => new PageSummaryController(config))

    useEffect(() => {
        if (config.extensionEnabled === false) {
            return
        }
        return installPageSummaryShortcut(
            config.pageSummaryShortcut ?? DEFAULT_PAGE_SUMMARY_SHORTCUT,
            () => {
                void controller
                    .start("manual")
                    .then(result => {
                        if (!result.success) {
                            Toast.show({
                                type: ToastType.ERROR,
                                message: result.message
                            })
                        }
                    })
                    .catch(() => {
                        Toast.show({
                            type: ToastType.ERROR,
                            message: "总结失败，请重试。"
                        })
                    })
            }
        )
    }, [config.pageSummaryShortcut, config.extensionEnabled, controller])
    useEffect(() => {
        if (controller.updateConfig(config)) void controller.start()
    }, [config, controller])
    useEffect(() => {
        void controller.start()
        const listener = (
            message: { type?: string; pageUrl?: string },
            _sender: chrome.runtime.MessageSender,
            respond: (value: unknown) => void
        ) => {
            if (message.type !== "MEWCAT_SUMMARY_ACTION") return
            if (message.pageUrl && message.pageUrl !== location.href) {
                respond({ success: false, message: "页面已变化，请重新尝试。" })
                return
            }
            void controller
                .start("manual")
                .then(respond)
                .catch(() =>
                    respond({ success: false, message: "总结失败，请重试。" })
                )
            return true
        }
        chrome.runtime.onMessage.addListener(listener)
        let pageUrl = location.href
        const navigation = (message: { type?: string }) => {
            if (message.type === "TAB_UPDATED" && pageUrl !== location.href) {
                pageUrl = location.href
                controller.cancel()
            }
        }
        chrome.runtime.onMessage.addListener(navigation)
        return () => {
            controller.cancel()
            chrome.runtime.onMessage.removeListener(listener)
            chrome.runtime.onMessage.removeListener(navigation)
        }
    }, [controller])
    return null
}
