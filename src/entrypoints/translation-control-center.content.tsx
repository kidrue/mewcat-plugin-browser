import { createRoot } from "react-dom/client"

import { createShadowRootUi, defineContentScript } from "#imports"

import { MonitoringErrorBoundary } from "@/components/MonitoringErrorBoundary"
import TranslationControlCenter, {
    getShadowHostId
} from "@/contents/TranslationControlCenter"
import { registerUiFonts } from "@/utils/fonts"

export default defineContentScript({
    matches: ["<all_urls>"],
    cssInjectionMode: "ui",
    async main(ctx) {
        registerUiFonts()
        const ui = await createShadowRootUi(ctx, {
            name: "mewcat-translation-control-center",
            position: "inline",
            anchor: "body",
            append: "last",
            onMount(container, _shadow, shadowHost) {
                shadowHost.id = getShadowHostId()
                const app = document.createElement("div")
                container.append(app)
                const root = createRoot(app)
                root.render(
                    <MonitoringErrorBoundary
                        feature="page-translation"
                        operation="render"
                        fallbackRender={() => null}
                    >
                        <TranslationControlCenter />
                    </MonitoringErrorBoundary>
                )
                return root
            },
            onRemove(root) {
                root?.unmount()
            }
        })

        ui.mount()
    }
})
