import { useAtomValue } from "jotai"
import { useEffect } from "react"

import { defineContentScript } from "#imports"

import { MonitoringErrorBoundary } from "@/components/MonitoringErrorBoundary"
import { PageSummaryController } from "@/page-summary/PageSummaryController"
import { configAtom } from "@/state"
import { registerUiFonts } from "@/utils/fonts"

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

function PageSummaryApp() {
    const config = useAtomValue(configAtom)
    useEffect(() => {
        const controller = new PageSummaryController(config)
        void controller.start()
        return () => controller.cancel()
    }, [config])
    return null
}
