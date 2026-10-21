import { is, mergeDeepWithKey, uniq } from "ramda"

import type {
    GeneralRule,
    RuleConfig,
    SiteRule,
    TranslationRule
} from "@/types"
import { matchUrlPattern } from "@/utils"

/**
 * 规则引擎配置接口
 */
export interface RuleEngineConfig {
    /** 当前URL */
    currentUrl?: string
    /** 当前域名 */
    currentHostname?: string
}

/**
 * 规则引擎
 * 负责加载、匹配和管理翻译规则
 * 严格按照 rule.json 的数据结构设计
 *
 * 核心功能：
 * 1. 加载默认配置（rule.json）
 * 2. 匹配站点特定规则
 * 3. 合并配置（优先级: 站点规则 > 用户配置 > 默认配置）
 * 4. 提供规则查询接口
 */
export class RuleEngine {
    /** 通用规则（generalRule） */
    private generalRule: GeneralRule | null

    /** 所有站点特定规则 */
    private siteRules: SiteRule[]

    /** 当前匹配的站点规则 */
    private matchedRules: SiteRule[]

    /** 当前URL */
    private currentUrl: string

    /** 当前域名 */
    private currentHostname: string

    /** 是否已初始化 */
    private initialized: boolean = false

    constructor(config?: RuleEngineConfig) {
        this.currentUrl =
            config?.currentUrl ||
            (typeof window !== "undefined" ? window.location.href : "")
        this.currentHostname =
            config?.currentHostname ||
            (typeof window !== "undefined" ? window.location.hostname : "")

        // 注意：需要调用 initialize() 来异步加载规则
        this.generalRule = null
        this.siteRules = []
        this.matchedRules = []
    }

    /**
     * 异步初始化规则引擎
     * 加载 rule.json 作为默认配置
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return
        }

        try {
            // 动态导入 rule.json
            const config: RuleConfig = await fetch(
                chrome.runtime.getURL("/assets/rule.json")
            ).then(res => res.json())

            // 加载通用规则
            this.generalRule = config.generalRule

            // 加载站点特定规则
            this.siteRules = config.rules || []

            this.initialized = true
        } catch (error) {
            console.error(`❌ RuleEngine: 加载 rule.json 失败`, error)
            // 使用空配置作为后备
            this.generalRule = {}
            this.siteRules = []
            this.initialized = true
        }
    }

    /**
     * 合并所有规则的配置
     * 优先级：站点规则 > 通用规则
     *
     * 合并策略：
     * 1. 数组字段：合并去重（站点规则 + 通用规则）
     * 2. 对象字段：深度合并（站点规则覆盖通用规则）
     * 3. 基础类型：站点规则优先，未定义则使用通用规则
     * 4. 多个站点规则：按优先级逐层合并（优先级高的覆盖优先级低的）
     *
     * @param matchedRules 匹配的站点规则列表（按优先级排序，第一个优先级最高）
     * @param generalRule 通用规则
     * @returns 合并后的配置对象
     */
    public mergeAllRulesConfig(): TranslationRule {
        // 获取匹配的规则和通用规则
        const matchedRules = this.getMatchedRules()
        const generalRule = this.getGeneralRule()

        // 基础规则：从通用规则开始
        const merged = { id: "general", ...generalRule }

        // 如果没有匹配的站点规则，直接返回通用规则
        if (!matchedRules || matchedRules.length === 0) {
            return merged as TranslationRule
        }

        // 合并多个站点规则（从优先级低到高，这样高优先级的会覆盖低优先级的）
        const mergedSiteRule = this.mergeSiteRules(matchedRules)

        // 最终合并：通用规则 + 合并后的站点规则
        const result = this.deepMergeRules(merged, mergedSiteRule)

        return result
    }

    /**
     * 合并多个站点规则
     * 优先级：后面的覆盖前面的（matchedRules 已按优先级排序）
     *
     * @param siteRules 站点规则列表
     * @returns 合并后的站点规则
     */
    private mergeSiteRules(siteRules: SiteRule[]): TranslationRule {
        if (siteRules.length === 0) {
            return
        }

        if (siteRules.length === 1) {
            return { ...siteRules[0] }
        }

        return [...siteRules].reverse().reduce<SiteRule>((p, c) => {
            return this.deepMergeRules(p, c)
        }, {} as SiteRule)
    }

    /**
     * 深度合并两个规则对象
     * 使用 Ramda 的 mergeWithKey 实现智能合并
     *
     * 合并策略：
     * - 数组字段：合并去重
     * - 对象字段：深度合并
     * - excludeTags：支持 .add 和 .remove 操作
     * - 其他：源值覆盖
     *
     * @param target 目标对象
     * @param source 源对象
     * @returns 合并后的对象
     */
    private deepMergeRules(
        target: TranslationRule,
        source: TranslationRule
    ): TranslationRule {
        // 数组字段：合并去重
        const arrayFields = new Set([
            "selectors",
            "excludeSelectors",
            "additionalSelectors",
            "additionalExcludeSelectors",
            "stayOriginalSelectors",
            "additionalStayOriginalSelectors",
            "atomicBlockSelectors",
            "extraBlockSelectors",
            "extraInlineSelectors",
            "allBlockTags",
            "inlineTags",
            "excludeTags",
            "stayOriginalTags",
            "excludeRegexps",
            "noTranslateRegexp",
            "waitForSelectors",
            "injectedCss",
            "mutationObserverContainerSelectors",
            "mutationExcludeSelectors",
            "mutationExcludeContainsSelectors",
            "mutationObserverTagNames",
            "skipBuildContainerSelectors",
            "buildContainerSelectors",
            "skipIgnoreSelectors",
            "domPurifyAddTags",
            "secretRegexps",
            "detectionServiceOrder",
            "visibleObserverScreens",
            "matches",
            "excludeMatches",
            "selectorMatches"
        ])

        // 对象字段：深度合并
        const objectFields = new Set([
            "excludeSelectorsRegexes",
            "pageLangDetectWeight",
            "inputConfig",
            "mutationConfig",
            "imageRule",
            "subtitleRule",
            "darkModeRule",
            "aiRule",
            "pairs",
            "condition",
            "quickButtonRule",
            "liveSubtitleRule",
            "bodyRule"
        ])

        // 自定义合并策略函数
        const mergeStrategy = (
            key: string,
            leftValue: unknown,
            rightValue: unknown
        ): unknown => {
            // 跳过 null 和 undefined
            if (rightValue === null || rightValue === undefined) {
                return leftValue
            }

            // 数组字段：合并去重
            if (arrayFields.has(key)) {
                if (Array.isArray(rightValue)) {
                    const leftArray = Array.isArray(leftValue) ? leftValue : []
                    return uniq([...leftArray, ...rightValue])
                }
                return rightValue
            }

            // 对象字段：深度合并
            if (objectFields.has(key)) {
                if (is(Object, rightValue) && !Array.isArray(rightValue)) {
                    const leftObject = is(Object, leftValue)
                        ? (leftValue as Record<string, unknown>)
                        : {}
                    return {
                        ...leftObject,
                        ...(rightValue as Record<string, unknown>)
                    }
                }
                return rightValue
            }

            // 默认：右侧值覆盖左侧值
            return rightValue
        }

        // 使用 Ramda 的 mergeWithKey 进行合并
        const merged = mergeDeepWithKey<TranslationRule, TranslationRule>(
            mergeStrategy,
            target,
            source
        ) as TranslationRule

        // 处理数组属性的特殊操作：add 和 remove
        // 支持任意数组属性的 .add 和 .remove 操作
        merged.excludeTags = this.processArrayPropertyOperations(
            merged,
            source,
            "excludeTags"
        )
        merged.stayOriginalTags = this.processArrayPropertyOperations(
            merged,
            source,
            "stayOriginalTags"
        )
        merged.excludeSelectors = this.processArrayPropertyOperations(
            merged,
            source,
            "excludeSelectors"
        )
        merged.inlineTags = this.processArrayPropertyOperations(
            merged,
            source,
            "inlineTags"
        )
        merged.additionalExcludeSelectors = this.processArrayPropertyOperations(
            merged,
            source,
            "additionalExcludeSelectors"
        )

        merged.extraInlineSelectors = this.processArrayPropertyOperations(
            merged,
            source,
            "extraInlineSelectors"
        )

        return merged
    }

    /**
     * 通用数组属性操作处理器
     * 支持 property.add 和 property.remove 操作
     *
     * @param merged 合并后的规则对象
     * @param source 源规则对象
     * @param property 要处理的属性名
     * @returns 处理后的数组
     *
     * @example
     * // 处理 excludeTags
     * const result = processArrayPropertyOperations(merged, source, "excludeTags")
     *
     * // 支持的源规则格式：
     * // { "excludeTags.add": ["INPUT"], "excludeTags.remove": ["BUTTON"] }
     */
    private processArrayPropertyOperations<T = string>(
        merged: TranslationRule,
        source: TranslationRule,
        property: string
    ): T[] {
        // 获取基础数组
        let resultArray = Array.isArray(merged[property])
            ? [...merged[property]]
            : []

        // 处理 add 操作
        resultArray = this.processArrayPropertyAction(
            resultArray,
            source,
            property,
            "add"
        )

        // 处理 remove 操作
        resultArray = this.processArrayPropertyAction(
            resultArray,
            source,
            property,
            "remove"
        )

        // 去重并返回
        return uniq(resultArray) as T[]
    }

    /**
     * 处理数组属性的单个操作（add 或 remove）
     *
     * @param currentArray 当前数组
     * @param source 源规则对象
     * @param property 属性名
     * @param action 操作类型：'add' 或 'remove'
     * @returns 处理后的数组
     */
    private processArrayPropertyAction<T = string>(
        currentArray: T[],
        source: TranslationRule,
        property: string,
        action: "add" | "remove"
    ): T[] {
        const operationKey = `${property}.${action}` as keyof TranslationRule
        const operationValues = source[operationKey]

        if (!Array.isArray(operationValues) || operationValues.length === 0) {
            return currentArray
        }

        if (action === "add") {
            // 添加操作：合并数组
            const result = [...currentArray, ...(operationValues as T[])]
            return result
        }

        if (action === "remove") {
            // 移除操作：过滤数组
            const removeSet = new Set(operationValues)
            const result = currentArray.filter(
                item => !removeSet.has(item as unknown as never)
            )
            return result
        }

        return currentArray
    }

    /**
     * 匹配当前URL的站点规则
     * 按照优先级排序返回匹配的规则
     */
    public matchRules(): SiteRule[] {
        if (!this.initialized) {
            console.warn(`⚠️  RuleEngine: 尚未初始化，请先调用 initialize()`)
            return []
        }

        this.matchedRules = []

        for (const rule of this.siteRules) {
            if (this.isRuleMatched(rule)) {
                this.matchedRules.push(rule)
            }
        }

        return this.matchedRules
    }

    /**
     * 判断规则是否匹配当前URL
     * 支持三种匹配模式：
     * 1. matches: URL通配符匹配
     * 2. excludeMatches: URL排除匹配（优先级最高）
     * 3. selectorMatches: DOM选择器匹配
     */
    private isRuleMatched(rule: SiteRule): boolean {
        let matchedByUrl = false

        // 1. 检查是否有 matches 配置
        if (rule.matches && rule.matches.length > 0) {
            const matchesArray = Array.isArray(rule.matches)
                ? rule.matches
                : [rule.matches]
            // 检查 URL 是否匹配
            for (const pattern of matchesArray) {
                if (matchUrlPattern(pattern, this.currentUrl)) {
                    matchedByUrl = true
                    break
                }
            }

            // 如果有 matches 配置但没有匹配，直接返回 false
            if (!matchedByUrl) {
                return false
            }
        }

        // 2. 检查 excludeMatches（排除规则，优先级最高）
        if (rule.excludeMatches && rule.excludeMatches.length > 0) {
            const excludeMatchesArray = Array.isArray(rule.excludeMatches)
                ? rule.excludeMatches
                : [rule.excludeMatches]
            for (const pattern of excludeMatchesArray) {
                if (matchUrlPattern(pattern, this.currentUrl)) {
                    return false
                }
            }
        }

        // 3. 如果通过了 URL 匹配，返回 true
        if (matchedByUrl) {
            return true
        }

        // 4. 检查 selectorMatches（DOM选择器匹配）
        if (rule.selectorMatches && rule.selectorMatches.length > 0) {
            if (typeof document !== "undefined") {
                for (const selector of rule.selectorMatches) {
                    try {
                        if (selector && document.querySelector(selector)) {
                            return true
                        }
                    } catch {
                        // 选择器无效，忽略
                    }
                }
            }
        }

        // 5. 如果没有任何匹配配置，返回 false
        return false
    }

    /**
     * 获取通用规则
     */
    public getGeneralRule(): GeneralRule {
        return this.generalRule || ({} as GeneralRule)
    }

    /**
     * 获取所有站点规则
     */
    public getSiteRules(): SiteRule[] {
        return this.siteRules
    }

    /**
     * 获取当前匹配的规则
     */
    public getMatchedRules(): SiteRule[] {
        return this.matchedRules
    }

    /**
     * 获取合并后的规则配置
     * 合并优先级: 站点规则 > 通用规则
     * @returns 合并后的规则数组
     */
    public getMergedRules(): Array<Partial<GeneralRule & SiteRule>> {
        const merged: Array<Partial<GeneralRule & SiteRule>> = []

        // 如果有匹配的站点规则，合并通用规则和站点规则
        for (const siteRule of this.matchedRules) {
            merged.push({
                ...this.generalRule,
                ...siteRule
            })
        }

        // 如果没有匹配的站点规则，只返回通用规则
        if (merged.length === 0 && this.generalRule) {
            merged.push(this.generalRule as Partial<GeneralRule & SiteRule>)
        }

        return merged
    }

    /**
     * 根据规则ID获取特定规则
     * @param ruleId 规则ID
     */
    public getRuleById(ruleId: string): SiteRule | null {
        return this.siteRules.find(rule => rule.id === ruleId) || null
    }

    /**
     * 更新当前URL
     * @param url 新的URL
     */
    public updateUrl(url: string): void {
        this.currentUrl = url
        try {
            const urlObj = new URL(url)
            this.currentHostname = urlObj.hostname
        } catch {
            console.error(`❌ RuleEngine: 无效的URL: ${url}`)
        }

        // 重新匹配规则
        if (this.initialized) {
            this.matchRules()
        }
    }

    /**
     * 检查是否已初始化
     */
    public isInitialized(): boolean {
        return this.initialized
    }

    /**
     * 获取规则统计信息
     */
    public getStats(): {
        totalSiteRules: number
        matchedRules: number
        hasGeneralRule: boolean
        currentUrl: string
    } {
        return {
            totalSiteRules: this.siteRules.length,
            matchedRules: this.matchedRules.length,
            hasGeneralRule: this.generalRule !== null,
            currentUrl: this.currentUrl
        }
    }
}
