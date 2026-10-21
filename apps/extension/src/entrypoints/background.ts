import { defineBackground } from "#imports"

import { registerBackgroundListeners } from "@/background"
import { initializeSentry } from "@/monitoring"

export default defineBackground(() => {
    initializeSentry({ runtimeContext: "background", enableReplay: false })
    registerBackgroundListeners()
})
