import { defineBackground } from "#imports"

import { registerBackgroundListeners } from "@/background"
import { migrateRequestConcurrency } from "@/background/messages/update-config"
import { initializeSentry } from "@/monitoring"

export default defineBackground(() => {
    initializeSentry({ runtimeContext: "background", enableReplay: false })
    void migrateRequestConcurrency().catch(error => {
        console.error("请求并发配置升级失败，下次启动将重试:", error)
    })
    registerBackgroundListeners()
})
