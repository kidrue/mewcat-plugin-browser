import { fileURLToPath } from "node:url"
import { transformWithOxc } from "vite"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        exclude: [...configDefaults.exclude, ".worktrees/**"]
    },
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
            "@": fileURLToPath(new URL("../src", import.meta.url)),
            "#imports": fileURLToPath(
                new URL("./mocks/imports.ts", import.meta.url)
            )
        }
    },
    test: {
        exclude: [...configDefaults.exclude, ".worktrees/**"]
    }
})
