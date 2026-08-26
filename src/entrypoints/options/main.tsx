import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import Options from "@/options"

const container = document.getElementById("root")
if (!container) {
    throw new Error("Options root element not found")
}

createRoot(container).render(
    <StrictMode>
        <Options />
    </StrictMode>
)
