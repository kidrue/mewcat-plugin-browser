import { fileURLToPath } from "node:url"
import { transformWithOxc } from "vite"
import { defineConfig } from "vitest/config"

export default defineConfig({
    plugins: [
        {
            name: "test-tsx-transform",
            enforce: "pre",
            async transform(code, id) {
                if (!id.endsWith(".tsx")) {
                    return null
                }
                return transformWithOxc(code, id, {
                    lang: "tsx",
                    jsx: { runtime: "automatic" }
                })
            }
        }
    ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("../src", import.meta.url))
        }
    }
})
