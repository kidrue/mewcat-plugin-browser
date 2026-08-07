import { plasmoShadowRootContainerId } from "../constants/dom"
/**
 * 翻译样式相关工具函数
 * 根据配置提供不同的翻译文本显示样式
 */

import {
    TranslationStyle,
    type TranslationStyleType
} from "../types/translationStyle"

function getPlasmoShadowRoot() {
    return document.querySelector("plasmo-csui")?.shadowRoot
}

export function getPlasmoShadowContainer() {
    return getPlasmoShadowRoot()?.querySelector(
        `#${plasmoShadowRootContainerId}`
    ) as HTMLElement
}

//see https://github.com/PlasmoHQ/plasmo/issues/652
export function injectCssText(cssText: string) {
    const plasmoCsui = getPlasmoShadowRoot()
    const style = document.createElement("style")
    style.textContent = cssText
    plasmoCsui?.appendChild(style)
}

// 为了向后兼容，保留原有的类型别名
export type TranslationStyleUnion = TranslationStyleType

/**
 * 获取翻译样式的CSS文本
 *
 * 注意：译文注入的是任意第三方页面，拿不到扩展的 CSS 变量，
 * 因此这里的朱砂 / 纸 / 墨都必须写字面值，与 theme.scss 的 token 保持一致。
 */
export function getTranslationStyleCSS(
    style: TranslationStyleType = TranslationStyle.HIGHLIGHT
): string {
    // 朱砂 #b23a2e / 纸 #fbf8f0 / 墨 #1a1714
    const baseStyle = `
        font-style: normal;
        font-weight: normal;
        display: inline-block;
        border-radius: 2px;
        transition: all 0.2s ease;
    `

    switch (style) {
        case TranslationStyle.NONE:
            return `
                font-style: normal;
                font-weight: normal;
                display: inline-block;
                margin: 0;
                padding: 0;
                border: none;
                background: transparent;
                color: inherit;
                font-size: inherit;
                line-height: inherit;
            `

        case TranslationStyle.HIGHLIGHT:
            return (
                baseStyle +
                `
                color: #1a1714;
                background: #fbf3e4;
                border-left: 3px solid #b23a2e;
                padding: 2px 8px;
            `
            )

        case TranslationStyle.UNDERLINE:
            return (
                baseStyle +
                `
                color: inherit;
                background: transparent;
                text-decoration: underline;
                text-decoration-color: #b23a2e;
                text-decoration-thickness: 2px;
                text-underline-offset: 3px;
            `
            )

        case TranslationStyle.BACKGROUND:
            return (
                baseStyle +
                `
                color: #1a1714;
                background: #f7efe6;
                border: 1px solid #e4d8c6;
                padding: 2px 8px;
            `
            )

        case TranslationStyle.BORDER:
            return (
                baseStyle +
                `
                color: inherit;
                background: transparent;
                border: 1px solid #b23a2e;
                border-radius: 2px;
                padding: 2px 8px;
            `
            )

        case TranslationStyle.SHADOW:
            return (
                baseStyle +
                `
                color: inherit;
                background: transparent;
                /* 朱砂在文字右下方留一道浅影，像盖印时的偏移 */
                text-shadow: 1px 1px 0 rgba(178, 58, 46, 0.34);
            `
            )

        default:
            // 默认使用高亮样式
            return getTranslationStyleCSS(TranslationStyle.HIGHLIGHT)
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
            // 这些样式可以内联显示
            return false
        case TranslationStyle.HIGHLIGHT:
        case TranslationStyle.BACKGROUND:
        case TranslationStyle.BORDER:
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
            // 内联样式使用span
            return "span"
        case TranslationStyle.HIGHLIGHT:
        case TranslationStyle.BACKGROUND:
        case TranslationStyle.BORDER:
        default:
            // 块级样式使用div
            return "div"
    }
}

/**
 * 获取样式的描述信息
 */
export function getStyleDescription(style: TranslationStyleType): string {
    switch (style) {
        case TranslationStyle.NONE:
            return "无样式 - 不添加任何特殊样式"
        case TranslationStyle.HIGHLIGHT:
            return "高亮显示 - 米色底，左侧一道朱砂"
        case TranslationStyle.UNDERLINE:
            return "下划线 - 朱砂色下划线标识"
        case TranslationStyle.BACKGROUND:
            return "背景色 - 淡朱砂底加细边"
        case TranslationStyle.BORDER:
            return "边框 - 朱砂色细边框包围"
        case TranslationStyle.SHADOW:
            return "阴影 - 文字带一道朱砂偏影"
        default:
            return "默认样式"
    }
}
