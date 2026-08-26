import { createRoot } from "react-dom/client"

import { createShadowRootUi, defineContentScript } from "#imports"

import TranslationControlCenter, {
    getShadowHostId
} from "@/contents/TranslationControlCenter"

export default defineContentScript({
    matches: ["<all_urls>"],
    cssInjectionMode: "ui",
    async main(ctx) {
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
                root.render(<TranslationControlCenter />)
                return root
            },
            onRemove(root) {
                root?.unmount()
            }
        })

        ui.mount()
    }
})
