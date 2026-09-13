import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { initializeSentry } from "@/monitoring"
import Options from "@/options"
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
