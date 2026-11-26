import { defineContentScript } from "#imports"

import { initializeSentry } from "@/services/monitoring"

export default defineContentScript({
    matches: ["<all_urls>"],
    runAt: "document_start",
    main() {
        initializeSentry({
            runtimeContext: "content",
            enableReplay: true,
            pageUrl: location.href
        })
    }
})
