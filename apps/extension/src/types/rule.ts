/**
 * ISO 639-1 语言代码（原子类型）
 * 兜底 string 兼容自定义语言码
 */
export type LanguageCode =
    | "zh"
    | "zh-CN"
    | "zh-TW"
    | "en"
    | "en-US"
    | "en-GB"
    | "ja"
    | "ko"
    | "fr"
    | "de"
    | "es"
    | "ru"
    | "pt"
    | "auto" // 自动检测
    | string

/**
 * CSS 选择器（原子类型）
 */
export type CssSelector = string

/**
 * 页面类型
 */
export type PageType =
    | "subtitleBuilder"
    | "pdfReader"
    | "ebookReader"
    | "ebookBuilder"
    | "normal"

export type TranslationMode = "translation" | "dual"
/**
 * 替换规则原子（文本替换的最小单元）
 */
export interface ReplaceRuleAtom {
    /** 匹配内容（字符串/正则表达式字符串） */
    match: string
    /** 替换内容 */
    replace: string
    /** 匹配模式 */
    mode: "string" | "regex"
    /** 是否全局匹配（仅 regex 生效） */
    global?: boolean
    /** 是否忽略大小写（仅 regex 生效） */
    ignoreCase?: boolean
}

/**
 * 暗黑模式规则
 */
export interface DarkModeRule {
    /** 检测元素 */
    element: string
    /** 选择器列表 */
    selectors: string[]
}

/**
 * 输入配置
 */
export interface InputConfig {
    /** 是否启用清除内容 */
    clearContentEnable?: boolean
    /** 是否启用 execCommand 删除 */
    execCommandDeleteEnable?: boolean
    /** 是否启用范围删除内容 */
    enableRangeDeleteContent?: boolean
    /** 是否启用自动语言 */
    autoLanguageEnable?: boolean
    /** 是否启用页面自动语言 */
    autoLanguagePageEnable?: boolean
    /** 自动语言站点列表 */
    autoLanguageSites?: string[]
    /** 自动语言站点（大陆） */
    autoLanguageSitesMainland?: string[]
}

/**
 * 变更配置
 */
export interface MutationConfig {
    /** 消费超时时间 */
    consumeTimeout?: number
    /** 构建超时时间 */
    buildTimeout?: number
    /** 是否检查自身更新 */
    checkSelfUpdate?: boolean
}

/**
 * 图片规则
 */
export interface ImageRule {
    /** 类型 */
    type?: string
    /** 是否启用漫画浮球 */
    enableMangaFloatBall?: boolean
    /** 阻止工具的 URL 列表 */
    blockToolsUrls?: string[]
    /** 是否启用图片 src 观察器 */
    enableImageSrcObserver?: boolean
    /** 图片翻译 URL 列表 */
    imageTranslationUrls?: string[]
    /** 是否启用 */
    enable?: boolean
    /** 漫画翻译器 */
    mangaTranslator?: string
    /** 通用翻译器 */
    commonTranslator?: string
    /** 是否启用工具 */
    enableTools?: boolean
    /** 是否启用鼠标悬停 */
    enableMouseHover?: boolean
    /** 图片翻译提供商 */
    imageTranslateProvider?: string
    /** 悬停最小宽度 */
    hoverMinWidth?: number
    /** 悬停最小高度 */
    hoverMinHeight?: number
    /** 工具最小宽度 */
    toolsMinWidth?: number
    /** 工具最小高度 */
    toolsMinHeight?: number
    /** 并发数 */
    concurrency?: number
    /** 查询间隔时间 */
    queryIntervalTime?: number
    /** 错误次数 */
    errorTimes?: number
    /** 错误间隔 */
    errorInterval?: number
    /** 客户端 OCR 超时 */
    clientOcrTimeout?: number
    /** 客户端翻译超时 */
    clientTranslateTimeout?: number
    /** 是否启用图片翻译 */
    enableImageTranslation?: string
    /** 支持平台 */
    supportPlatform?: Record<string, string>
    /** 检测服务顺序 */
    detectionServiceOrder?: string[]
    /** 工具延迟时间 */
    toolsDelayTime?: number
    /** 客户端支持语言 */
    clientSupportLangs?: string[]
    /** 拉丁语言 */
    latinLang?: string[]
    /** 不支持的正则表达式 */
    notSupportRegexes?: string[]
    /** 忽略错误的正则表达式 */
    ignoreErrorRegexes?: string[]
    /** 不翻译的正则表达式 */
    noTranslateRegexes?: string[]
    /** 移除文本的正则表达式 */
    removeTextRegexes?: string[]
    /** 替换文本的正则表达式 */
    replaceTextRegexes?: Array<[string, string]>
}

/**
 * 字幕规则
 */
export interface SubtitleRule {
    /** ID */
    id?: string
    /** 默认降级服务 */
    defaultFallbackServices?: string[]
    /** 是否注入 */
    isInject?: boolean
    /** 预翻译 */
    preTranslation?: boolean
    /** 人工优先 */
    humanPreferred?: boolean
    /** 会议自动启用字幕 */
    meetingAutoEnableSubtitle?: boolean
    /** AI 字幕优先 */
    aiSubtitlePreferred?: boolean
    /** 是否禁用 */
    disabled?: boolean
    /** 钩子类型 */
    hookType?: string
    /** 是否显示快速按钮 */
    showQuickButton?: boolean
    /** 背景颜色 */
    backgroundColor?: string
    /** 背景透明度 */
    backgroundOpacity?: string
    /** 类型 */
    type?: string
    /** 视频播放器选择器 */
    videoPlayerSelector?: string
    /** 是否启用触发翻译 */
    enableTriggerTranslate?: boolean
    /** 加载样式 */
    loadingStyle?: string
    /** 注入的 CSS */
    injectedCss?: string[]
    /** 多视频容器选择器 */
    multipleVideoContainerSelector?: string
    /** 快速按钮规则 */
    quickButtonRule?: {
        appendSelector?: string
        insertBeforeSelector?: string
        injectCSS?: string
    }
    /** 实时字幕规则 */
    liveSubtitleRule?: {
        containerSelector?: string
        reportSelector?: string
        textSelectors?: string[]
        mutationChangeDelay?: number
    }
    /** 是否启用 iOS 全屏文本轨道 */
    enableIOSFullScreenTextTrack?: boolean
}

/**
 * Body 规则
 */
export interface BodyRule {
    /** 是否启用 */
    enable?: boolean
    /** Body 选择器 */
    bodySelector?: string
    /** 文章选择器 */
    articleSelector?: string
}

/**
 * 词汇表项
 */
export interface GlossaryItem {
    /** 键 */
    k: string
    /** 值 */
    v: string
}

/**
 * 高级合并配置项
 */
export interface AdvanceMergeConfigItem {
    /** 条件表达式 */
    condition: string
    /** 高级配置 */
    advanceConfig: Record<string, unknown>
}

/**
 * 全局规则配置
 */
export interface GeneralRule {
    /** 注释 */
    _comment?: string
    /** 隐私协议版本 */
    privacyProtocolVersion?: string
    /** 隐私协议启用时间 */
    privacyProtocolEnableTime?: string
    /** DOM 检查超时 */
    domCheckTimeout?: number
    /** 段落最小文本数 */
    paragraphMinTextCount?: number
    /** 段落最小单词数 */
    paragraphMinWordCount?: number
    /** 块最小文本数 */
    blockMinTextCount?: number
    /** 块最小单词数 */
    blockMinWordCount?: number
    /** 语言检测最小文本数 */
    languageDetectMinTextCount?: number
    /** 主框架最小文本数 */
    mainFrameMinTextCount?: number
    /** 主框架最小单词数 */
    mainFrameMinWordCount?: number
    /** 侧边栏最大文本数 */
    asideMaxTextCount?: number
    /** 侧边栏最大单词数 */
    asideMaxWordCount?: number
    /** 侧边栏最大文本数 */
    asideMaxTextCountPerParagraph?: number
    /** 侧边栏段落最大单词数 */
    asideMaxWordCountPerParagraph?: number
    /** 原子块选择器 */
    atomicBlockSelectors?: string[]
    /** 翻译选择器 */
    selectors?: string[]
    /** 排除选择器 */
    excludeSelectors?: string[]
    /** 额外排除选择器 */
    additionalExcludeSelectors?: string[]
    /** 保留原文选择器 */
    stayOriginalSelectors?: string[]
    /** 额外保留原文选择器 */
    additionalStayOriginalSelectors?: string[]
    /** 额外选择器 */
    additionalSelectors?: string[]
    /** 所有块级标签 */
    allBlockTags?: string[]
    /** 内联标签 */
    inlineTags?: string[]
    /** 排除标签 */
    excludeTags?: string[]
    /** 保留原文标签 */
    stayOriginalTags?: string[]
    /** 翻译时保留的标签（如 a、code 等，翻译后仍保留这些标签及其属性） */
    preserveTagsInTranslation?: string[]
    /** 浮动效果段落数 */
    floatEffectParagraphNum?: number
    /** 浮动块效果段落数 */
    floatBlockEffectParagraphs?: number
    /** 是否净化富文本 HTML */
    purifyRichHtml?: boolean
    /** 长构建 DOM 长度 */
    longBuildDomLength?: number
    /** 长构建页面长度 */
    longBuildPageLength?: number
    /** 重复翻译次数 */
    repeatTranslateNum?: number
    /** 检测文本缓冲区长度 */
    detectTextBufferLength?: number
    /** 小代码长度 */
    smallCodeLength?: number
    /** 是否强制格式化 pre 标签 */
    forceFormatPre?: boolean
    /** 长 HTML 文本长度 */
    longHtmlTextLength?: number
    /** 是否启用站点自动翻译 */
    enableSiteAutoTranslate?: boolean
    /** 可见观察器屏幕 */
    visibleObserverScreens?: number[]
    /** 跳过忽略选择器 */
    skipIgnoreSelectors?: string[]
    /** 页面语言检测权重 */
    pageLangDetectWeight?: Record<string, number>
    /** DOM 净化添加标签 */
    domPurifyAddTags?: string[]
    /** 服务变更时是否翻译 */
    isTranslateWhenServiceChanged?: boolean
    /** 排除选择器正则表达式 */
    excludeSelectorsRegexes?: Record<string, string[]>
    /** 跳过构建容器选择器 */
    skipBuildContainerSelectors?: string[]
    /** 构建容器选择器 */
    buildContainerSelectors?: string[]
    /** 是否启用跳过构建容器 */
    enableSkipBuildContainer?: boolean
    /** 词汇表 */
    glossaries?: GlossaryItem[]
    /** 排除正则表达式 */
    excludeRegexps?: string[]
    /** 秘密正则表达式 */
    secretRegexps?: string[]
    /** 检测服务顺序 */
    detectionServiceOrder?: string[]
    /** 是否检测段落语言 */
    detectParagraphLanguage?: boolean
    /** 段落首字母字体大小 */
    paragraphFirstLetterFontSize?: number
    /** Toast 错误最小次数 */
    toastErrorMinTimes?: number
    /** 是否启用字幕 */
    enableSubtitle?: boolean
    /** 是否禁用新文本翻译 */
    disableNewTextTranslate?: boolean
    /** 是否跳过可编辑检查 */
    skipEditableCheck?: boolean
    /** 条件 */
    condition?: Record<string, unknown>
    /** 规范化 body */
    normalizeBody?: string
    /** 输入配置 */
    inputConfig?: InputConfig
    /** PDF 新段落行高 */
    pdfNewParagraphLineHeight?: number
    /** PDF 新段落缩进 */
    pdfNewParagraphIndent?: number
    /** PDF 新段落缩进右缩进像素 */
    pdfNewParagraphIndentRightIndentPx?: number
    /** 触摸时切换翻译页面的手指数 */
    fingerCountToToggleTranslagePageWhenTouching?: number
    /** 触摸时切换翻译遮罩的手指数 */
    fingerCountToToggleTranslationMaskWhenTouching?: number
    /** 触摸时切换仅翻译页面的手指数 */
    fingerCountToToggleTranslagePageOnlyTranslationWhenTouching?: number
    /** 触摸快捷键切换翻译页面 */
    touchShortcutsToggleTranslatePage?: string
    /** 触摸快捷键输入翻译 */
    touchShortcutsInputTranslate?: string
    /** 触摸快捷键切换翻译遮罩 */
    touchShortcutsToggleTranslationMask?: string
    /** 触摸快捷键切换仅翻译页面 */
    touchShortcutsToggleTranslatePageOnlyTranslation?: string
    /** 触摸快捷键切换翻译触摸元素 */
    touchShortcutsToggleTranslateTouchElement?: string
    /** 触摸快捷键切换翻译触摸元素偏好键 */
    touchShortcutsToggleTranslateTouchElementPreferenceKey?: string
    /** 鼠标悬停按住键 */
    mouseHoverHoldKey?: string
    /** 鼠标悬停偏好键 */
    mouseHoverPreferenceKey?: string
    /** 鼠标按住翻译延迟 */
    mousePressHoldTranslateDelay?: number
    /** 暗黑模式规则 */
    darkModeRule?: DarkModeRule
    /** 是否启用通过 referrer 自动翻译 */
    enableAutoTranslateByReferrer?: boolean
    /** 变更配置 */
    mutationConfig?: MutationConfig
    /** 图片规则 */
    imageRule?: ImageRule
    /** 是否使用 iframe postMessage */
    useIframePostMessage?: boolean

    // ========== 新增的 MutationObserver 配置 ==========
    /** 是否启用 MutationObserver */
    mutationObserverEnabled?: boolean
    /** 是否检测 URL 变化 */
    mutationEnableUrlChange?: boolean
    /** 是否检查自我更新（防止翻译结果再次触发） */
    mutationCheckSelfUpdate?: boolean
    /** 变更观察器限制目标选择器 */
    mutationObserverLimitTargetSelectors?: string[]
    /** 变更排除选择器 */
    mutationExcludeSelectors?: string[]
    /** 变更排除包含选择器 */
    mutationExcludeContainsSelectors?: string[]
    /** 变更观察器标签名 */
    mutationObserverTagNames?: string[]
    /** 变更观察器容器选择器 */
    mutationObserverContainerSelectors?: string[]
    /** 构建翻译容器的防抖延迟（毫秒） */
    mutationBuildTimeout?: number
    /** 文本变化处理的防抖延迟（毫秒） */
    mutationConsumeTimeout?: number
    /** 同一节点最多翻译次数（防止死循环） */
    mutationRepeatTranslateNum?: number
    /** Layer 4: 跳过动态标记的选择器 */
    skipDynamicMarkSelectors?: string[]
    /** URL 黑名单（这些 URL 不启用 MutationObserver） */
    mutationBlockUrls?: string[]
    /** 搜索增强配置 */
    searchEnhancementConfig?: unknown[]
    /** 注入的 CSS */
    injectedCss?: string[]
    /** 是否为引导页 */
    isOnBoardingPage?: boolean
    /** 是否为电子书 */
    isEbook?: boolean
    /** 是否为电子书构建器 */
    isEbookBuilder?: boolean
    /** 是否忽略简繁中文 */
    ignoreZhCNandZhTW?: boolean
    /** 是否在 Safari 上显示赞助 */
    showSponsorOnSafari?: boolean
    /** 不翻译正则表达式 */
    noTranslateRegexp?: string[]
    /** 等待选择器 */
    waitForSelectors?: string[]
    /** 是否注入选项 URL */
    isInjectOptionsUrl?: boolean
    /** 是否注入版本 */
    isInjectVersion?: boolean
    /** 是否注入 meta */
    isInjectMeta?: boolean
    /** 等待选择器超时 */
    waitForSelectorsTimeout?: number
    /** 配对 */
    pairs?: Record<string, string>
    /** AI 规则 */
    aiRule?: Record<string, unknown>
    /** 字幕规则 */
    subtitleRule?: SubtitleRule
}

/**
 * 站点特定规则
 */
export interface SiteRule {
    // ========== 基础信息 ==========
    id: string // 规则唯一标识符，如 "github"

    // ========== 页面匹配 ==========
    matches?: string[] // URL 匹配规则，支持通配符
    // 例如: ["github.com", "*.github.com"]
    excludeMatches?: string[] // URL 排除规则
    // 例如: ["github.com/login"]
    selectorMatches?: string[] // 页面元素匹配（页面识别）
    // 例如: ["meta[property='og:site_name'][content='GitHub']"]

    // ========== DOM选择器配置 ==========
    selectors?: string[] // 🔑 主选择器（白名单）
    // 为空 [] = 全页面模式
    // 非空 = 只翻译匹配区域
    // 例如: [".article", "#main-content"]
    extraBlockSelectors?: string[] // 额外块级选择器
    // 例如: [".post-content", ".blog-body"]

    additionalSelectors?: string[] // 补充选择器（强制包含）
    // 即使不在 selectors 中也会翻译
    // 例如: ["h1", "h2", "h3"]

    additionalExcludeSelectors?: string[] // 额外排除选择器
    // 例如: [".no-translate", "#footer"]

    excludeSelectors?: string[] // 🚫 排除选择器（黑名单，最高优先级）
    // 强制不翻译的区域
    // 例如: ["nav", "footer", ".ad", "code"]

    /** 额外排除选择器 - 在现有 excludeSelectors 基础上添加 */
    ["excludeSelectors.add"]?: string[]

    /** 移除排除选择器 - 从现有 excludeSelectors 中移除 */
    ["excludeSelectors.remove"]?: string[]

    stayOriginalSelectors?: string[] // 🔒 保留原文选择器
    // 元素本身不翻译，但处理子元素
    // 例如: ["pre", "kbd"]

    additionalStayOriginalSelectors?: string[] // 额外保留原文选择器
    // 例如: [".no-translate-special"]

    atomicBlockSelectors?: string[] // ⚛️ 原子块选择器
    // 作为整体翻译，不拆分子元素
    // 例如: ["table td", ".quote-block"]

    extraInlineSelectors?: string[] // 额外内联选择器
    // 例如: [".inline-text", "span.highlight"]
    ["extraInlineSelectors.add"]?: string[]

    // ========== 标签过滤 ==========
    excludeTags?: string[] // 排除的HTML标签（不翻译）
    // 例如: ["SCRIPT", "STYLE", "SVG", "BUTTON"]

    /** 额外排除标签 - 在现有 excludeTags 基础上添加 */
    ["excludeTags.add"]?: string[]

    /** 移除排除标签 - 从现有 excludeTags 中移除 */
    ["excludeTags.remove"]?: string[]

    stayOriginalTags?: string[] // 保留原文的HTML标签
    // 例如: ["CODE", "TT", "IMG", "SUP"]

    /** 额外保留原文标签 - 在现有 stayOriginalTags 基础上添加 */
    ["stayOriginalTags.add"]?: string[]

    /** 移除保留原文标签 - 从现有 stayOriginalTags 中移除 */
    ["stayOriginalTags.remove"]?: string[]

    inlineTags?: string[] // 内联标签（不单独翻译，跟随父元素）
    // 例如: ["A", "SPAN", "B", "I", "STRONG"]

    /** 额外内联标签 - 在现有 inlineTags 基础上添加 */
    ["inlineTags.add"]?: string[]

    /** 移除内联标签 - 从现有 inlineTags 中移除 */
    ["inlineTags.remove"]?: string[]

    // ========== 正则表达式过滤 ==========
    excludeRegexps?: string[] // 内容排除正则表达式
    // 匹配的文本不翻译
    // 例如: ["^\\d+$", "^[A-Z_]+$"]

    noTranslateRegexp?: string[] // 不翻译内容的正则表达式
    // 例如: ["^@\\w+", "^#\\w+"]

    excludeSelectorsRegexes?: Record<string, string[]>
    // 选择器特定的正则排除
    // 键: CSS选择器
    // 值: 正则表达式数组
    // 例如: { "td, th": ["^[0-9,]+$"] }

    // ========== 文本验证配置 ==========
    paragraphMinTextCount?: number // 段落最小字符数（默认: 2）
    // 少于此数量的文本不翻译

    paragraphMinWordCount?: number // 段落最小单词数（默认: 1）
    // 少于此数量的单词不翻译

    blockMinTextCount?: number // 块级元素最小字符数（默认: 24）

    blockMinWordCount?: number // 块级元素最小单词数（默认: 4）

    // ========== MutationObserver配置 ==========
    mutationObserverContainerSelectors?: string[]
    // 监听动态变化的容器
    // 例如: [".timeline", ".feed"]

    mutationExcludeSelectors?: string[] // 排除监听的选择器
    // 这些元素的变化不触发翻译
    // 例如: [".loading", ".skeleton"]

    mutationChangeDelay?: number // 变化延迟触发时间（毫秒，默认: 10）
    // 去抖处理，避免频繁触发

    // ========== 其他配置 ==========
    translationMode?: TranslationMode // 翻译模式（dual/translation/original）
    detectParagraphLanguage?: boolean // 是否检测段落语言
    targetLanguage?: string
}

/**
 * 完整规则配置
 */
export interface RuleConfig {
    /** 全局规则 */
    generalRule: GeneralRule
    /** 站点特定规则列表 */
    rules: SiteRule[]
}

/**
 * 翻译规则
 */
export type TranslationRule = SiteRule & GeneralRule
