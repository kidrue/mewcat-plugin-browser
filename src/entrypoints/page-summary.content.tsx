import { useAtomValue } from "jotai"
import { useEffect } from "react"

import { defineContentScript } from "#imports"

import { PageSummaryController } from "@/page-summary/PageSummaryController"
import { configAtom } from "@/state"

export default defineContentScript({
    matches: ["<all_urls>"],
    runAt: "document_idle",
    async main() {
        const container = document.createElement("div")
        document.documentElement.append(container)
        const { createRoot } = await import("react-dom/client")
        createRoot(container).render(<PageSummaryApp />)
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
