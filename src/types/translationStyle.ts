/**
 * 翻译样式枚举
 * 定义支持的翻译文本显示样式类型
 */
export enum TranslationStyle {
    /** 无样式 - 使用译文字体，不添加装饰 */
    NONE = "none",

    /** 高亮显示 - 浅蓝纸面与天空蓝侧线 */
    HIGHLIGHT = "highlight",

    /** 下划线 - 轻盈蓝色下划线 */
    UNDERLINE = "underline",

    /** 背景色 - 柔和浅蓝底与圆角留白 */
    BACKGROUND = "background",

    /** 边框 - 浅蓝细边框包围 */
    BORDER = "border",

    /** 阴影 - 轻柔蓝色文字投影 */
    SHADOW = "shadow",

    /** 侧边线 - 透明底与轻量左侧标识线 */
    SIDE_LINE = "side-line",

    /** 柔和荧光笔 - 只在文字下半部铺色 */
    MARKER = "marker",

    /** 信纸分隔 - 译文上方细虚线 */
    LETTER_DIVIDER = "letter-divider"
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
    | "side-line"
    | "marker"
    | "letter-divider"
