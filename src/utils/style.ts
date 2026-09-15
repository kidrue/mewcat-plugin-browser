import { extensionShadowRootContainerId } from "../constants/dom"
import { UI_FONT_FAMILY } from "../constants/fonts"
/**
 * 翻译样式相关工具函数
 * 根据配置提供不同的翻译文本显示样式
 */

import {
    DEFAULT_TRANSLATION_STYLE,
    TranslationStyle,
    type TranslationStyleType
} from "../types/translationStyle"

const extensionUiHostIds = [
    "translation-control-center-overlay",
    "mewcat-overlay-selection",
    "mewcat-image-translate"
]

function getExtensionShadowRoot() {
    for (const id of extensionUiHostIds) {
        const shadowRoot = document.getElementById(id)?.shadowRoot
        if (shadowRoot) {
            return shadowRoot
        }
    }
    return null
}

export function getExtensionShadowContainer() {
    return getExtensionShadowRoot()?.querySelector(
        `#${extensionShadowRootContainerId}`
    ) as HTMLElement
}

export function injectCssText(cssText: string) {
    const shadowRoot = getExtensionShadowRoot()
    const style = document.createElement("style")
    style.textContent = cssText
    shadowRoot?.appendChild(style)
}

// 为了向后兼容，保留原有的类型别名
export type TranslationStyleUnion = TranslationStyleType

const bubbleThemes = {
    [TranslationStyle.BUBBLE_POSTAL]: {
        color: "#203b57",
        start: "#eef7ff",
        end: "#d5eafd",
        border: "#9ec9e9",
        radius: "1.25em 1.5em 1.1em 0.65em",
        description: "晴空邮喵 - 抱信白猫与蓝白云纹，像一封轻轻送达的来信"
    },
    [TranslationStyle.BUBBLE_BLUE]: {
        color: "#183f65",
        start: "#dff3ff",
        end: "#bee3ff",
        border: "#91c9ef",
        radius: "1.5em 1.5em 1.1em 1.5em",
        description: "云朵猫猫 - 云端小猫插画与轻柔天空纹理"
    },
    [TranslationStyle.BUBBLE_PINK]: {
        color: "#71354f",
        start: "#fff0f5",
        end: "#ffe1ed",
        border: "#efb5cc",
        radius: "1.3em 1.3em 0.65em 1.3em",
        description: "樱花兔兔 - 樱花小兔插画与花瓣粉色纸面"
    },
    [TranslationStyle.BUBBLE_MINT]: {
        color: "#205647",
        start: "#e5faf2",
        end: "#d1f3e5",
        border: "#9dd7bf",
        radius: "0.85em 1.3em 1.3em 1.3em",
        description: "森林蛙蛙 - 荷叶小蛙插画与清新森林底纹"
    },
    [TranslationStyle.BUBBLE_PURPLE]: {
        color: "#493774",
        start: "#eeeaff",
        end: "#dcdfff",
        border: "#bbb0e7",
        radius: "1.1em",
        description: "星月猫猫 - 月亮小猫插画与梦幻星光"
    },
    [TranslationStyle.BUBBLE_ORANGE]: {
        color: "#704721",
        start: "#fff5dc",
        end: "#ffe6be",
        border: "#e8bd82",
        radius: "1.4em 1.4em 1.4em 0.65em",
        description: "布丁小熊 - 布丁小熊插画与奶油格纹"
    }
}

function getBubbleTheme(style: TranslationStyleType) {
    return Object.prototype.hasOwnProperty.call(bubbleThemes, style)
        ? bubbleThemes[style as keyof typeof bubbleThemes]
        : undefined
}

/**
 * 获取翻译样式的CSS文本
 *
 * 注意：译文注入的是任意第三方页面，拿不到扩展的 CSS 变量，
 * 因此这里的天空蓝 / 纸 / 深蓝灰都必须写字面值，与 theme.scss 的 token 保持一致。
 */
export function getTranslationStyleCSS(
    style: TranslationStyleType = DEFAULT_TRANSLATION_STYLE
): string {
    // 字体直接写入译文节点，避免继承宿主网页的字体或文字变换。
    const baseStyle = `
        font-family: ${UI_FONT_FAMILY} !important;
        font-size: inherit;
        font-style: normal;
        font-weight: 400;
        line-height: 1.75;
        letter-spacing: normal;
        word-spacing: normal;
        text-transform: none;
        text-indent: 0;
        word-break: normal;
        overflow-wrap: anywhere;
        box-sizing: border-box;
        max-width: 100%;
        min-width: 0;
        vertical-align: baseline;
    `
    const panelStyle = `
        display: inline-block;
        position: relative;
        padding: 0.3em 0.7em;
        border-radius: 8px;
    `

    const bubble = getBubbleTheme(style)
    if (bubble) {
        // 扩展内预览和第三方网页均从扩展包加载插画，不向宿主站点请求资源。
        const assetPath = `/assets/translation-bubbles/${style}.webp`
        const assetUrl =
            typeof chrome !== "undefined" && chrome.runtime?.getURL
                ? chrome.runtime.getURL(assetPath)
                : assetPath
        const textures = {
            [TranslationStyle.BUBBLE_POSTAL]:
                "radial-gradient(ellipse at 18% 100%, #ffffffcc 0 28%, transparent 30%)",
            [TranslationStyle.BUBBLE_BLUE]:
                "radial-gradient(ellipse at 20% 100%, #ffffffcc 0 25%, transparent 26%)",
            [TranslationStyle.BUBBLE_PINK]:
                "radial-gradient(ellipse at 30% 70%, #f3b7d04d 0 12%, transparent 14%)",
            [TranslationStyle.BUBBLE_MINT]:
                "radial-gradient(ellipse at 15% 90%, #b3dec766 0 22%, transparent 24%)",
            [TranslationStyle.BUBBLE_PURPLE]:
                "radial-gradient(circle, #ffffffdd 0 1.5px, transparent 2px)",
            [TranslationStyle.BUBBLE_ORANGE]:
                "repeating-linear-gradient(90deg, #edc48b26 0 8px, transparent 8px 16px)"
        }
        return (
            baseStyle +
            `
            display: inline-block;
            position: relative;
            overflow: visible;
            white-space: normal;
            text-align: start;
            margin: 0;
            min-width: min(100%, 12em);
            min-height: 0;
            max-width: 100%;
            padding: 0.3em calc(min(4em, 22%) + 0.7em) 0.3em 0.7em;
            border: 1px solid ${bubble.border};
            border-radius: ${bubble.radius};
            color: ${bubble.color};
            background-color: ${bubble.start};
            background-image: url("${assetUrl}"), ${textures[style as keyof typeof textures]}, linear-gradient(145deg, #ffffffee, ${bubble.start} 55%, ${bubble.end});
            background-size: min(4em, 22%) auto, 32px 14px, 100% 100%;
            background-position: right 0.3em center, left bottom, center;
            background-repeat: no-repeat, repeat-x, no-repeat;
            text-shadow: none;
            box-shadow: inset 0 0 0 3px #ffffff80, 0 4px 12px ${bubble.border}35;
        `
        )
    }

    switch (style) {
        case TranslationStyle.NONE:
            return (
                baseStyle +
                `
                display: inline;
                margin: 0;
                padding: 0;
                border: none;
                background: transparent;
                color: inherit;
                text-shadow: none;
            `
            )

        case TranslationStyle.HIGHLIGHT:
            return (
                baseStyle +
                panelStyle +
                `
                color: #203b57;
                background: #f0f7ff;
                border: 1px solid #dcebf8;
                border-inline-start: 3px solid #2878c8;
            `
            )

        case TranslationStyle.UNDERLINE:
            return (
                baseStyle +
                `
                display: inline;
                color: inherit;
                background: transparent;
                text-decoration: underline;
                text-decoration-color: #70afe0;
                text-decoration-thickness: 0.08em;
                text-underline-offset: 0.22em;
                text-decoration-skip-ink: auto;
            `
            )

        case TranslationStyle.BACKGROUND:
            return (
                baseStyle +
                panelStyle +
                `
                color: #203b57;
                background: #e8f4ff;
                border: 1px solid transparent;
            `
            )

        case TranslationStyle.BORDER:
            return (
                baseStyle +
                panelStyle +
                `
                color: inherit;
                background: transparent;
                border: 1px solid #91bee5;
            `
            )

        case TranslationStyle.SHADOW:
            return (
                baseStyle +
                `
                display: inline;
                color: inherit;
                background: transparent;
                text-shadow: 0 1px 2px rgba(40, 120, 200, 0.22);
            `
            )

        case TranslationStyle.SIDE_LINE:
            return (
                baseStyle +
                `
                display: inline-block;
                padding: 0.22em 0.6em 0.22em 0.8em;
                color: inherit;
                background-color: transparent;
                border: none;
                border-left: 3px solid #70afe0;
            `
            )

        case TranslationStyle.MARKER:
            return (
                baseStyle +
                `
                display: inline;
                padding: 0;
                color: inherit;
                background-color: transparent;
                background-image: linear-gradient(to top, #d9edff 0, #d9edff 44%, transparent 44%);
                -webkit-box-decoration-break: clone;
                box-decoration-break: clone;
            `
            )

        case TranslationStyle.LETTER_DIVIDER:
            return (
                baseStyle +
                `
                display: block;
                margin-top: 0.3em;
                padding: 0.55em 0 0;
                color: inherit;
                background-color: transparent;
                border: none;
                border-top: 1px dashed #91bee5;
            `
            )

        default:
            return getTranslationStyleCSS(DEFAULT_TRANSLATION_STYLE)
    }
}

/**
 * 根据样式类型调整插入策略
 */
export function shouldInsertAsBlock(style: TranslationStyleType): boolean {
    switch (style) {
        case TranslationStyle.NONE:
        case TranslationStyle.UNDERLINE:
        case TranslationStyle.SHADOW:
        case TranslationStyle.MARKER:
            // 这些样式可以内联显示
            return false
        case TranslationStyle.HIGHLIGHT:
        case TranslationStyle.BACKGROUND:
        case TranslationStyle.BORDER:
        case TranslationStyle.SIDE_LINE:
        case TranslationStyle.LETTER_DIVIDER:
        default:
            // 这些样式需要块级显示
            return true
    }
}

/**
 * 获取翻译容器的标签类型
 */
export function getTranslationElementTag(style: TranslationStyleType): string {
    switch (style) {
        case TranslationStyle.NONE:
        case TranslationStyle.UNDERLINE:
        case TranslationStyle.SHADOW:
        case TranslationStyle.MARKER:
            // 内联样式使用span
            return "span"
        case TranslationStyle.HIGHLIGHT:
        case TranslationStyle.BACKGROUND:
        case TranslationStyle.BORDER:
        case TranslationStyle.SIDE_LINE:
        case TranslationStyle.LETTER_DIVIDER:
        default:
            // 块级样式使用div
            return "div"
    }
}

/**
 * 获取样式的描述信息
 */
export function getStyleDescription(style: TranslationStyleType): string {
    const bubble = getBubbleTheme(style)
    if (bubble) {
        return bubble.description
    }
    switch (style) {
        case TranslationStyle.NONE:
            return "无样式 - 寒蝉全圆体，保留网页文字颜色"
        case TranslationStyle.HIGHLIGHT:
            return "高亮显示 - 浅蓝纸面与天空蓝侧线"
        case TranslationStyle.UNDERLINE:
            return "下划线 - 轻盈蓝线，自然随正文换行"
        case TranslationStyle.BACKGROUND:
            return "背景色 - 柔和浅蓝底与圆角留白"
        case TranslationStyle.BORDER:
            return "边框 - 浅蓝细边框，保留网页文字颜色"
        case TranslationStyle.SHADOW:
            return "阴影 - 轻柔蓝色文字投影"
        case TranslationStyle.SIDE_LINE:
            return "侧边线 - 透明底与轻量蓝色左侧线"
        case TranslationStyle.MARKER:
            return "柔和荧光笔 - 文字下半部铺浅蓝底色"
        case TranslationStyle.LETTER_DIVIDER:
            return "信纸分隔 - 译文上方蓝色细虚线"
        default:
            return "默认样式"
    }
}
