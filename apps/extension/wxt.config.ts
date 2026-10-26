import { execFileSync } from "node:child_process"
import { defineConfig } from "wxt"

export default defineConfig({
    srcDir: "src",
    publicDir: "src/public",
    manifestVersion: 3,
    browser: "chrome",
    dev: { server: { port: 3001, strictPort: true } },
    targetBrowsers: ["chrome"],
    imports: false,
    modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
    autoIcons: {
        baseIconPath: "public/assets/icon.png"
    },
    vite: env => ({
        build: { sourcemap: env.mode === "production" ? "hidden" : false }
    }),
    hooks: {
        "build:publicAssets": (_wxt, files) => {
            // 图标源文件仅供构建或留档，运行时使用自动生成的 icons/*。
            for (let index = files.length - 1; index >= 0; index--) {
                const relativePath = files[index].relativeDest.replaceAll(
                    "\\",
                    "/"
                )
                if (
                    relativePath === "assets/icon.png" ||
                    relativePath === "assets/icon-128.png"
                ) {
                    files.splice(index, 1)
                }
            }
        },
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
        name: "mewCat 译趣喵 - 网页翻译与双语阅读",
        short_name: "mewCat",
        description:
            "网页双语翻译、划词翻译和图片翻译，支持 Google、Microsoft 翻译及自定义 AI 模型，轻松阅读外语文章、技术文档与海外资讯。",
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
