import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { MonitoringErrorBoundary } from "@/components/MonitoringErrorBoundary"
import { initializeSentry } from "@/monitoring"
import SidePanel from "@/sidepanel"
import { registerUiFonts } from "@/utils/fonts"

initializeSentry({ runtimeContext: "sidepanel", enableReplay: true })
registerUiFonts()

const container = document.getElementById("root")
if (!container) {
    throw new Error("Side panel root element not found")
}

createRoot(container).render(
    <StrictMode>
        <MonitoringErrorBoundary feature="sidepanel" operation="render">
            <SidePanel />
        </MonitoringErrorBoundary>
    </StrictMode>
)
