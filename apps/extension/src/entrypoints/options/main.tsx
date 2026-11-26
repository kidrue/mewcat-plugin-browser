import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import Options from "@/pages/options"
import { initializeSentry } from "@/services/monitoring"
import { registerUiFonts } from "@/utils/fonts"

initializeSentry({ runtimeContext: "options", enableReplay: true })
registerUiFonts()

const container = document.getElementById("root")
if (!container) {
    throw new Error("Options root element not found")
}

createRoot(container).render(
    <StrictMode>
        <Options />
    </StrictMode>
)
