/**
 * 翻译样式枚举
 * 定义支持的翻译文本显示样式类型
 */
export enum TranslationStyle {
    /** 无样式 - 不添加任何特殊样式 */
    NONE = "none",

    /** 高亮显示 - 米色底，左侧一道朱砂 */
    HIGHLIGHT = "highlight",

    /** 下划线 - 朱砂色下划线标识 */
    UNDERLINE = "underline",

    /** 背景色 - 淡朱砂底加细边 */
    BACKGROUND = "background",

    /** 边框 - 朱砂色细边框包围 */
    BORDER = "border",

    /** 阴影 - 文字带一道朱砂偏影 */
    SHADOW = "shadow"
}

/**
 * 翻译样式联合类型
 * 为了向后兼容，保留字符串字面量类型
 */
export type TranslationStyleType =
    | TranslationStyle
    | "none"
    | "highlight"
    | "underline"
    | "background"
    | "border"
    | "shadow"
