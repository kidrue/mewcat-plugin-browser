import { createRoot } from "react-dom/client"

import { createShadowRootUi, defineContentScript } from "#imports"

import { MonitoringErrorBoundary } from "@/components/MonitoringErrorBoundary"
import ImageTranslateContent, {
    getShadowHostId
} from "@/contents/imageTranslate"
import { registerUiFonts } from "@/utils/fonts"

export default defineContentScript({
    matches: ["<all_urls>"],
    allFrames: false,
    cssInjectionMode: "ui",
    async main(ctx) {
        registerUiFonts()
        const ui = await createShadowRootUi(ctx, {
            name: "mewcat-image-translate",
            position: "inline",
            anchor: "body",
            append: "last",
            onMount(container, _shadow, shadowHost) {
                shadowHost.id = getShadowHostId()
                shadowHost.style.pointerEvents = "none"
                const app = document.createElement("div")
                container.append(app)
                const root = createRoot(app)
                root.render(
                    <MonitoringErrorBoundary
                        feature="image-translation"
                        operation="render"
                        fallbackRender={() => null}
                    >
                        <ImageTranslateContent />
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
