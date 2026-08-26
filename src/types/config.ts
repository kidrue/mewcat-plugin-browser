import type { BaseModel } from "./aiModel"
import type { TranslationStyleType } from "./translationStyle"

/**
 * 插件主配置对象
 */
export interface ExtensionConfig {
    /** 是否启用划词翻译（true为划词，false为整页） */
    isSelectedTranslate: boolean

    /** 翻译成该语言 (翻译后的目标语言) */
    targetLanguage: string

    /** 识别到网页的语言（需要被翻译的源语言） */
    detectedLanguage: string

    /** ai专家角色（决定AI提示词风格） */
    aiRole: AiRole

    /** 永不翻译的语言列表 */
    neverTranslateLanguages?: string[]

    /** 总是翻译的URL列表 */
    alwaysTranslateUrls?: string[]

    /** 永不翻译的URL列表 */
    neverTranslateUrls?: string[]

    /** 总是翻译的语言列表 */
    alwaysTranslateLanguages?: string[]

    /** 翻译样式配置（如字体、颜色等） */
    translationStyle?: TranslationStyleType

    // 翻译服务相关配置
    /** 是否启用Google翻译 */
    enableGoogleTranslate?: boolean

    /** 是否启用微软翻译 */
    enableMicrosoftTranslate?: boolean

    /** 是否启用腾讯翻译 */
    enableTencentTranslate?: boolean

    aiModelList: BaseModel[]

    /** 每秒最大请求数（限流） */
    maxRequestsPerSecond?: number

    /** 单次请求最大文本长度 */
    maxTextLengthPerRequest?: number

    // 划词翻译相关配置
    /** 划词触发模式（直接、点按钮、shift、ctrl） */
    selectionTriggerMode: "direct" | "dot" | "shift" | "ctrl"

    /** 划词交互模式（点击或悬停） */
    selectionInteractionMode?: "click" | "hover"

    /** 禁用划词翻译的网站列表 */
    selectionDisabledSites?: string[]

    // 扩展功能相关配置
    /** 是否启用扩展（总开关） */
    extensionEnabled?: boolean

    /** 是否启用翻译缓存 */
    cacheEnabled?: boolean

    // 可视区域优先翻译相关配置
    /** 可视区域最小节点阈值（低于该值则全量翻译） */
    minVisibleNodesThreshold?: number

    /** 是否优先翻译可视区域 */
    prioritizeVisibleArea?: boolean

    /** 网页自动翻译延迟时间（毫秒） */
    autoTranslateDelay: number

    /** 当前使用模型 */
    currentModel?: string

    /** 自定义保护正则表达式（用于保护特殊文本不被翻译） */
    customProtectionRegexps?: string[]

    /** 是否启用文本保护（默认true） */
    enableTextProtection?: boolean

    /** 占位符分隔符配置（默认 ["<", ">", "b"]） */
    placeholderDelimiters?: [string, string] | [string, string, string]

    /** 是否启用 AI 思考能力（适用于支持思考的模型，默认 false） */
    enableThinking?: boolean

    /** 是否启用 AI 智能上下文翻译（默认 false） */
    enableContext?: boolean

    /** 是否在图片上显示快捷翻译按钮（默认 false） */
    enableImageTranslateButton?: boolean

    /** 图片翻译使用的视觉模型 ID（默认空，表示尚未选择） */
    imageTranslationModelId?: string

    /** 图片翻译服务商（默认 "系统"，禁止修改） */
    imageTranslateProvider?: string
}

// AI角色枚举（英文键值，中文注释说明角色含义）
export enum AiRole {
    // 默认翻译角色
    DEFAULT = "DEFAULT",
    // 意译大师：擅长在保持原意基础上进行自然转化的翻译专家
    FREE_TRANSLATOR = "FREE_TRANSLATOR",
    // 段落总结专家：提炼文本核心信息的专业总结师
    PARAGRAPH_SUMMARIZER = "PARAGRAPH_SUMMARIZER",
    // 英文简化大师：将复杂英文转化为简单表达的专家
    ENGLISH_SIMPLIFIER = "ENGLISH_SIMPLIFIER",
    // 潜意识学习：将知识自然融入日常表达的引导者
    SUBLIMINAL_LEARNING = "SUBLIMINAL_LEARNING",
    // 中英夹杂：自然融合中英双语表达的专家
    CODE_MIXING_CN_EN = "CODE_MIXING_CN_EN",
    // 白话文转文言文：将现代白话文转化为文言文的古文专家
    COLLOQUIAL_TO_CLASSICAL = "COLLOQUIAL_TO_CLASSICAL",
    // 分词对照翻译助手：提供分词与对应翻译的对照工具
    WORD_SEG_TRANSLATOR = "WORD_SEG_TRANSLATOR",
    // Twitter翻译增强器：适配Twitter平台的翻译工具
    TWITTER_TRANSLATOR = "TWITTER_TRANSLATOR",
    // 科技类翻译大师：精通科技领域术语的翻译专家
    TECH_TRANSLATOR = "TECH_TRANSLATOR",
    // Reddit翻译增强器：适配Reddit社区的翻译工具
    REDDIT_TRANSLATOR = "REDDIT_TRANSLATOR",
    // 学术论文翻译师：符合学术规范的论文翻译专家
    ACADEMIC_TRANSLATOR = "ACADEMIC_TRANSLATOR",
    // 新闻媒体译者：适配新闻写作风格的翻译专家
    NEWS_TRANSLATOR = "NEWS_TRANSLATOR",
    // 音乐专家：精通音乐领域知识的专业顾问
    MUSIC_EXPERT = "MUSIC_EXPERT",
    // 医学翻译大师：精通医学术语的专业翻译
    MEDICAL_TRANSLATOR = "MEDICAL_TRANSLATOR",
    // 法律行业译者：符合法律行业规范的翻译专家
    LEGAL_TRANSLATOR = "LEGAL_TRANSLATOR",
    // GitHub翻译增强器：适配GitHub平台的翻译工具
    GITHUB_TRANSLATOR = "GITHUB_TRANSLATOR",
    // 游戏译者：适配游戏场景的专业翻译
    GAME_TRANSLATOR = "GAME_TRANSLATOR",
    // 金融翻译顾问：精通金融术语的翻译专家
    FINANCE_TRANSLATOR = "FINANCE_TRANSLATOR",
    // 小说译者：擅长文学性翻译的小说翻译专家
    FICTION_TRANSLATOR = "FICTION_TRANSLATOR",
    // 电商翻译大师：适配电商场景的专业翻译
    ECOMMERCE_TRANSLATOR = "ECOMMERCE_TRANSLATOR",
    // 电子书译者：适配电子书格式的翻译专家
    EBOOK_TRANSLATOR = "EBOOK_TRANSLATOR",
    // 设计师：提供设计相关建议的专业顾问
    DESIGNER = "DESIGNER",
    // 东北话：擅长用东北方言表达的语言专家
    NORTHEAST_DIALECT = "NORTHEAST_DIALECT",
    // 文言文转白话文：将文言文转化为现代白话文的专家
    CLASSICAL_TO_COLLOQUIAL = "CLASSICAL_TO_COLLOQUIAL",
    // 国际象棋专家：提供国际象棋相关指导的专业顾问
    CHESS_EXPERT = "CHESS_EXPERT",
    // AO3译者：适配AO3平台的翻译工具
    AO3_TRANSLATOR = "AO3_TRANSLATOR",
    // 词汇助手：提供词汇解析与应用的辅助工具
    VOCABULARY_ASSISTANT = "VOCABULARY_ASSISTANT",
    // Web3翻译大师：精通Web3领域术语的翻译专家
    WEB3_TRANSLATOR = "WEB3_TRANSLATOR"
}

export type DeepPartial<T extends object> =
    // 处理数组：如果是数组，递归处理数组元素
    T extends Array<infer U>
        ? Array<U extends object ? DeepPartial<U> : U>
        : // 处理对象：映射所有属性为可选，并递归处理子对象
          {
              [K in keyof T]?: T[K] extends object
                  ? DeepPartial<T[K]> // 子属性是对象时递归处理
                  : T[K] // 非对象类型直接设为可选
          }
