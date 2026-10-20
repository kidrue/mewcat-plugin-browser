import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import Feedback from "@/feedback"
import { registerUiFonts } from "@/utils/fonts"

registerUiFonts()

const container = document.getElementById("root")
if (!container) {
    throw new Error("Feedback root element not found")
}

createRoot(container).render(
    <StrictMode>
        <Feedback />
    </StrictMode>
)
