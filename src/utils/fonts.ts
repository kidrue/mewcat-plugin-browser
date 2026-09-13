import fontFaceStyles from "@/styles/fonts.scss?raw"

// 字体声明必须注册在 document，才能同时供普通 DOM 和 Shadow DOM 使用。
// 使用运行时绝对路径，避免网页浮层向宿主网站请求字体。
export function registerUiFonts(): void {
    const styleId = "mewcat-ui-fonts"
    if (document.getElementById(styleId)) {
        return
    }

    const style = document.createElement("style")
    style.id = styleId
    style.textContent = fontFaceStyles.replaceAll(
        "/assets/fonts/",
        chrome.runtime.getURL("/assets/fonts/")
    )
    ;(document.head || document.documentElement).append(style)
}
