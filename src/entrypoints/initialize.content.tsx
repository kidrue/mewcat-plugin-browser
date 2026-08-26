import { createRoot } from "react-dom/client"

import { createShadowRootUi, defineContentScript } from "#imports"

import Initialize, { getShadowHostId } from "@/contents/initialize"

export default defineContentScript({
    matches: ["<all_urls>"],
    cssInjectionMode: "ui",
    async main(ctx) {
        const ui = await createShadowRootUi(ctx, {
            name: "mewcat-initialize",
            position: "inline",
            anchor: "body",
            append: "last",
            onMount(container, _shadow, shadowHost) {
                shadowHost.id = getShadowHostId()
                const app = document.createElement("div")
                container.append(app)
                const root = createRoot(app)
                root.render(<Initialize />)
                return root
            },
            onRemove(root) {
                root?.unmount()
            }
        })

        ui.mount()
    }
})
