import { defineConfig } from "wxt"

export default defineConfig({
    srcDir: "src",
    publicDir: "src/public",
    manifestVersion: 3,
    browser: "chrome",
    targetBrowsers: ["chrome"],
    imports: false,
    modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
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
                resources: ["assets/**"],
                matches: ["<all_urls>", "http://127.0.0.1/*"]
            }
        ]
    },
    zip: {
        artifactTemplate: "chrome-mv3-prod.zip"
    }
})
