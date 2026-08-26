// Options页面相关常量

import { TranslationStyle } from "../types/translationStyle"

export interface NavigationItem {
    id: string
    label: string
    description: string
}

// 导航菜单配置
export const NAVIGATION_ITEMS: NavigationItem[] = [
    { id: "basic", label: "基本配置", description: "语言和网址设置" },
    { id: "translation", label: "翻译服务", description: "翻译模型配置" },
    { id: "selection", label: "划词翻译", description: "划词翻译设置" },
    { id: "image", label: "图片", description: "图片翻译设置" },
    { id: "about", label: "关于", description: "扩展信息和缓存设置" }
]

// 译文样式选项
export const TRANSLATION_STYLE_OPTIONS = [
    { value: TranslationStyle.NONE, label: "无样式" },
    { value: TranslationStyle.HIGHLIGHT, label: "高亮显示" },
    { value: TranslationStyle.UNDERLINE, label: "下划线" },
    { value: TranslationStyle.BACKGROUND, label: "背景色" },
    { value: TranslationStyle.BORDER, label: "边框" },
    { value: TranslationStyle.SHADOW, label: "阴影" }
]

// 触发方式选项
export const TRIGGER_MODE_OPTIONS = [
    { value: "direct", label: "直接触发" },
    { value: "dot", label: "小圆点" },
    { value: "shift", label: "按住Shift" },
    { value: "ctrl", label: "按住Ctrl" }
]

// 交互方式选项
export const INTERACTION_MODE_OPTIONS = [
    { value: "click", label: "点击" },
    { value: "hover", label: "悬浮" }
]

// 禁用网站选项
export const DISABLED_SITES_OPTIONS = [
    { value: "github.com", label: "GitHub" },
    { value: "stackoverflow.com", label: "StackOverflow" },
    { value: "docs.google.com", label: "Google Docs" },
    { value: "google.com", label: "Google" },
    { value: "youtube.com", label: "YouTube" },
    { value: "twitter.com", label: "Twitter" },
    { value: "facebook.com", label: "Facebook" },
    { value: "reddit.com", label: "Reddit" },
    { value: "linkedin.com", label: "LinkedIn" },
    { value: "instagram.com", label: "Instagram" }
]

// 扩展信息
export const EXTENSION_INFO = {
    version: "v0.0.1",
    author: "kidrue",
    description: "智能网页翻译助手，支持多种翻译引擎和划词翻译"
}

// 默认配置值
export const DEFAULT_VALUES = {
    maxRequestsPerSecond: 5,
    maxTextLengthPerRequest: 1000,
    minRequestsPerSecond: 1,
    maxRequestsPerSecondLimit: 100,
    minTextLength: 100,
    maxTextLengthLimit: 10000,
    autoTranslateDelay: 700
}
