import { createRoot } from "react-dom/client"

import { createShadowRootUi, defineContentScript } from "#imports"

import ImageTranslateContent, {
    getShadowHostId
} from "@/contents/imageTranslate"

export default defineContentScript({
    matches: ["<all_urls>"],
    allFrames: false,
    cssInjectionMode: "ui",
    async main(ctx) {
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
                root.render(<ImageTranslateContent />)
                return root
            },
            onRemove(root) {
                root?.unmount()
            }
        })

        ui.mount()
    }
})
