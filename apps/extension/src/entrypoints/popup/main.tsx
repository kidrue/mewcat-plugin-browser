import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { MonitoringErrorBoundary } from "@/components/MonitoringErrorBoundary"
import Popup from "@/pages/popup"
import { initializeSentry } from "@/services/monitoring"
import { registerUiFonts } from "@/utils/fonts"

initializeSentry({ runtimeContext: "popup", enableReplay: true })
registerUiFonts()

const container = document.getElementById("root")
if (!container) {
    throw new Error("Popup root element not found")
}

createRoot(container).render(
    <StrictMode>
        <MonitoringErrorBoundary feature="popup" operation="render">
            <Popup />
        </MonitoringErrorBoundary>
    </StrictMode>
)
