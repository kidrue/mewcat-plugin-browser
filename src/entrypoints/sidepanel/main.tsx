import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import SidePanel from "@/sidepanel"

const container = document.getElementById("root")
if (!container) {
    throw new Error("Side panel root element not found")
}

createRoot(container).render(
    <StrictMode>
        <SidePanel />
    </StrictMode>
)
