import { defineConfig } from "wxt"
import { execFileSync } from "node:child_process"

export default defineConfig({
    srcDir: "src",
    publicDir: "src/public",
    manifestVersion: 3,
    browser: "chrome",
    targetBrowsers: ["chrome"],
    imports: false,
    modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
    vite: env => ({ build: { sourcemap: env.mode === "production" ? "hidden" : false } }),
    hooks: {
        "build:done": wxt => {
            if (wxt.config.mode === "production") {
                execFileSync(
                    process.execPath,
                    ["scripts/upload-sentry-sourcemaps.cjs", wxt.config.outDir],
                    { stdio: "inherit" }
                )
            }
        }
    },
    manifest: {
        name: "mewCat",
        host_permissions: ["<all_urls>"],
        permissions: [
            "storage",
            "sidePanel",
            "tabs",
            "scripting",
            "contextMenus",
            "declarativeNetRequest",
            "declarativeNetRequestWithHostAccess"
        ],
        web_accessible_resources: [
            {
                resources: ["assets/**", "icons/**"],
                matches: ["<all_urls>", "http://127.0.0.1/*"]
            }
        ]
    },
    zip: {
        artifactTemplate: "chrome-mv3-prod.zip"
    }
})
