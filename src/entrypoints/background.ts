import { defineBackground } from "#imports"

import { registerBackgroundListeners } from "@/background"

export default defineBackground(() => {
    registerBackgroundListeners()
})
