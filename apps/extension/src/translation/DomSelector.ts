import { franc } from "franc"

import type { TranslationRule } from "@/types"
import { setTranslateUniqueId } from "@/utils"
import { isDevelopment } from "@/utils/environment"
import { getEnhancedLanguageCode } from "@/utils/francLanguageMap"

import { DOMTraverser, type TranslationNode } from "./DOMTraverser"
import { EDITABLE_SELECTOR, EXTENSION_SELECTOR } from "./paragraphShortcut"
import { PerformanceMonitor } from "./PerformanceMonitor"
import { RuleEngine } from "./RuleEngine"

/**
 * DomSelector 配置接口
 */
export interface DomSelectorConfig {
    /** 当前URL（可选，默认使用 window.location.href） */
    currentUrl?: string
    /** 当前域名（可选，默认使用 window.location.hostname） */
    currentHostname?: string
    /** 永不翻译的语言列表（可选） */
    neverTranslateLanguages?: string[]
    /** 总是翻译的语言列表（可选） */
    alwaysTranslateLanguages?: string[]
    /** 是否启用可视区域优先（可选，默认 true） */
    prioritizeVisibleArea?: boolean
    /** 最小可视节点阈值（可选，默认 20） */
    minVisibleNodesThreshold?: number
}

/**
 * DOM 选择器
 * 新架构：完全模块化设计
 *
 * 核心模块：
 * - RuleEngine: 规则加载和匹配
 * - TextValidator: 文本检测和验证
 * - SelectorMatcher: 选择器匹配系统
 * - TagClassifier: 标签分类体系
 * - DOMTraverser: DOM遍历策略
 *
 * 严格按照 rule.json 数据结构和 DOM_PROCESSING_LOGIC.md 架构设计
 */
export class DomSelector {
    /** 规则引擎 */
    private ruleEngine: RuleEngine

    /** DOM遍历器 */
    private domTraverser: DOMTraverser | null = null

    /** 永不翻译的语言列表（可选） */
    private neverTranslateLanguages?: string[]
    /** 总是翻译的语言列表（可选） */
    private alwaysTranslateLanguages?: string[]

    /** 检测到的语言 */
    private detectedLanguage: string = ""
    private manualTranslation = false
    public setManualTranslation(enabled: boolean): void {
        this.manualTranslation = enabled
    }

    /**  */
    private mergedRule: TranslationRule

    /** 性能监控器（仅开发环境） */
    private performanceMonitor: PerformanceMonitor | null = null

    /** 可视区域优先配置 */
    private prioritizeVisibleArea: boolean = true
    private minVisibleNodesThreshold: number = 20

    /** 语言检测缓存：文本 -> 语言代码 */
    private languageCache: Map<string, string> = new Map()

    /**
     * 构造函数
     * @param config DomSelector 配置
     */
    constructor(config?: DomSelectorConfig) {
        // 1. 初始化规则引擎
        this.ruleEngine = new RuleEngine({
            currentUrl: config?.currentUrl,
            currentHostname: config?.currentHostname
        })

        // 2. 初始化语言配置
        this.neverTranslateLanguages = config?.neverTranslateLanguages
        this.alwaysTranslateLanguages = config?.alwaysTranslateLanguages

        // 3. 初始化可视区域配置
        this.prioritizeVisibleArea = config?.prioritizeVisibleArea ?? true
        this.minVisibleNodesThreshold = config?.minVisibleNodesThreshold ?? 20

        // 🕐 初始化性能监控器（仅开发环境）
        if (isDevelopment()) {
            this.performanceMonitor = new PerformanceMonitor({
                enabled: false,
                logLevel: "detailed",
                autoLog: true
            })
        }
    }

    /**
     * 异步初始化 DomSelector
     * 必须在使用 extractTargetTextNodes 前调用
     */
    public async initialize(): Promise<void> {
        // 1. 初始化规则引擎
        await this.ruleEngine.initialize()
        // 2. 匹配当前页面的规则
        this.ruleEngine.matchRules()

        // 3. 获取合并后的规则配置
        const mergedRules = this.ruleEngine.getMergedRules()
        const generalRule = this.ruleEngine.getGeneralRule()

        if (!generalRule || mergedRules.length === 0) {
            throw new Error("DomSelector 初始化失败：未找到通用规则或匹配规则")
        }
        this.mergedRule = this.ruleEngine.mergeAllRulesConfig()
    }

    /**
     * 提取目标文本节点
     * 根据规则列表提取需要翻译的 DOM 元素
     * @returns 需要翻译的 HTMLElement 数组及可视性分类
     */
    public extractTargetTextNodes(
        rootElement: HTMLElement = document.body,
        manual = false
    ): {
        result: TranslationNode[]
        stayOriginalMap: Record<string, Element>
        visibleNodes: TranslationNode[]
        nonVisibleNodes: TranslationNode[]
    } {
        // 🕐 开始性能监控
        this.performanceMonitor?.start("DomSelector.extractTargetTextNodes")

        if (!document.body) {
            throw new Error("DOM 树未加载完成，无法提取文本节点")
        }

        // 步骤2: 创建 DOMTraverser
        this.performanceMonitor?.startStage("创建遍历器")
        this.domTraverser = new DOMTraverser(this.mergedRule)
        this.performanceMonitor?.endStage()

        // 步骤3: 遍历DOM树（只遍历一次）
        this.performanceMonitor?.startStage("DOM遍历")
        const { list: allResults, stayOriginalMap } =
            this.domTraverser.traverse(rootElement)

        this.performanceMonitor?.endStage({
            nodeCount: allResults.length
        })

        // 步骤4: 去重：过滤重复节点和父子关系的节点
        this.performanceMonitor?.startStage("去重处理")
        const deduplicatedResults = this.deduplicateNodes(allResults)
        this.performanceMonitor?.endStage({
            originalCount: allResults.length,
            deduplicatedCount: deduplicatedResults.length
        })

        // 步骤5: 语言检测：对去重后的节点进行语言检测（优化：使用缓存减少 franc 调用次数）
        this.performanceMonitor?.startStage("语言检测(franc)")

        // 优化1: 检查是否需要语言检测
        const needsLanguageDetection =
            (this.alwaysTranslateLanguages &&
                this.alwaysTranslateLanguages.length > 0) ||
            (this.neverTranslateLanguages &&
                this.neverTranslateLanguages.length > 0)

        let francCallCount = 0
        let cacheHitCount = 0

        const resultsWithFranc = needsLanguageDetection
            ? deduplicatedResults.map(node => {
                  if (node.originText) {
                      // 优化2: 使用缓存避免重复检测相同文本
                      const cacheKey = node.originText.trim().substring(0, 100) // 使用前100字符作为缓存键
                      let francCode = this.languageCache.get(cacheKey)

                      if (francCode) {
                          cacheHitCount++
                      } else {
                          // 优化3: 对于极短文本（<10字符），跳过检测，使用 'und'
                          if (node.originText.length < 10) {
                              francCode = "und"
                          } else {
                              francCode = franc(node.originText, {
                                  minLength: 3
                              })
                              francCallCount++
                          }
                          this.languageCache.set(cacheKey, francCode)
                      }

                      return {
                          ...node,
                          francCode
                      }
                  }
                  return node
              })
            : deduplicatedResults // 如果不需要语言检测，直接使用原结果

        this.performanceMonitor?.endStage({
            francCalls: francCallCount,
            cacheHits: cacheHitCount,
            skipped: !needsLanguageDetection
        })

        // 步骤6: 语言过滤：根据 alwaysTranslateLanguages 和 neverTranslateLanguages 过滤节点
        this.performanceMonitor?.startStage("语言过滤")
        const filteredResults = resultsWithFranc.filter(
            node => manual || this.shouldTranslateNode(node)
        )
        this.performanceMonitor?.endStage({
            filteredCount: filteredResults.length
        })

        // 步骤7: 可视性分类（如果启用）
        let visibleNodes: TranslationNode[] = []
        let nonVisibleNodes: TranslationNode[] = []

        if (this.prioritizeVisibleArea) {
            this.performanceMonitor?.startStage("可视性分类")
            const classified = this.classifyNodesByVisibility(filteredResults)
            visibleNodes = classified.visibleNodes
            nonVisibleNodes = classified.nonVisibleNodes
            this.performanceMonitor?.endStage({
                visibleCount: visibleNodes.length,
                nonVisibleCount: nonVisibleNodes.length
            })
        }

        // 🕐 结束性能监控
        this.performanceMonitor?.end({
            totalNodes: allResults.length,
            deduplicatedNodes: deduplicatedResults.length,
            finalNodes: filteredResults.length,
            visibleNodes: visibleNodes.length,
            nonVisibleNodes: nonVisibleNodes.length
        })

        return {
            result: filteredResults,
            stayOriginalMap,
            visibleNodes,
            nonVisibleNodes
        }
    }

    public extractParagraphTextNodes(target: Element) {
        const empty = {
            result: [] as TranslationNode[],
            stayOriginalMap: {} as Record<string, Element>,
            visibleNodes: [] as TranslationNode[],
            nonVisibleNodes: [] as TranslationNode[]
        }
        if (
            !target.isConnected ||
            target.closest(`${EDITABLE_SELECTOR},${EXTENSION_SELECTOR},button`)
        )
            return empty
        const blocks =
            "p,li,blockquote,h1,h2,h3,h4,h5,h6,td,th,dd,dt,pre,figcaption"
        let root = target.closest<HTMLElement>(blocks)
        if (!root) {
            for (
                let element = target as HTMLElement;
                element && element !== document.body;
                element = element.parentElement
            ) {
                if (
                    ["block", "flex", "grid", "list-item"].includes(
                        getComputedStyle(element).display
                    )
                ) {
                    if (element.querySelector(`${blocks},div,section,article`))
                        return empty
                    root = element
                    break
                }
            }
        }
        if (!root) return empty
        const extracted = this.extractTargetTextNodes(root, true)
        return {
            ...extracted,
            result: extracted.result.filter(
                node =>
                    node.container === root ||
                    (root.matches(blocks) &&
                        node.container.closest(blocks) === root)
            )
        }
    }

    /**
     * 清理文本中的占位符标签
     * 移除保留原文的占位符，保留富文本标签中的可翻译文本用于去重。
     *
     * 占位符格式：
     * 1. @数字# - 如 @1#, @2# (stayOriginalSelectors 生成)
     * 2. <标签名数字>...</标签名数字> - 如 <a1>...</a1>, <code2>...</code2> (preserveTagsInTranslation 生成)
     *
     * @param text 原始文本
     * @param stayOriginalMap 占位符映射表
     * @returns 清理后的文本
     */
    private cleanPlaceholderTags(
        text: string,
        stayOriginalMap: Record<string, Element>
    ): string {
        if (!text || !stayOriginalMap) {
            return text
        }

        let cleanedText = text

        // 遍历 stayOriginalMap 中的所有 key，移除对应的占位符
        for (const key of Object.keys(stayOriginalMap)) {
            // 处理 @数字# 格式的占位符（直接出现在文本中）
            if (key.startsWith("@") && key.endsWith("#")) {
                // 直接替换占位符为空字符串
                cleanedText = cleanedText.replace(new RegExp(key, "g"), "")
            } else {
                // 只移除富文本包装标签；链接文本仍属于待翻译内容。
                // 清空标签内的文字会把不同的纯链接段落都当作空文本去重。
                const tagPattern = new RegExp(
                    `<${key}>([\\s\\S]*?)<\\/${key}>`,
                    "g"
                )
                cleanedText = cleanedText.replace(tagPattern, "$1")
            }
        }

        return cleanedText.trim()
    }

    /**
     * 获取 stayOriginalMap
     * @returns stayOriginalMap 对象
     */
    private getStayOriginalMap(): Record<string, Element> {
        if (!this.domTraverser) {
            return {}
        }
        // 访问 DOMTraverser 的私有属性 stayOriginalMap
        // 使用类型断言来访问私有属性
        return (
            (
                this.domTraverser as unknown as {
                    stayOriginalMap: Record<string, Element>
                }
            ).stayOriginalMap || {}
        )
    }

    /**
     * 去重节点列表
     * 规则：
     * 1. 容器相同且文本相同则不输出
     * 2. Result节点容器包含当前节点容器，且Result文本包含当前文本则不输出
     * 3. Result节点容器被当前节点容器包含，且当前文本包含Result文本则替换result中对应节点
     *
     * 注意：在比较文本时，会先根据 stayOriginalMap 清理掉占位符标签
     *
     * 性能优化：
     * - 使用 Map 缓存清理后的文本，避免重复调用 cleanPlaceholderTags
     * - 使用 Map 快速查找相同容器+文本的节点（规则1优化）
     * - 提前终止不必要的遍历
     *
     * @param nodes 待去重的节点列表
     * @returns 去重后的节点列表
     */
    private deduplicateNodes(nodes: TranslationNode[]): TranslationNode[] {
        const result: TranslationNode[] = []
        // 获取 stayOriginalMap
        const stayOriginalMap = this.getStayOriginalMap()

        // 性能优化1：使用 Map 缓存清理后的文本，避免重复调用 cleanPlaceholderTags
        const cleanedTextCache = new Map<string, string>()

        // 性能优化2：使用 Map 快速查找相同容器+文本的节点（规则1优化）
        // key: container + cleanedText 的组合
        const containerTextMap = new Map<string, boolean>()

        // 性能优化3：使用 WeakMap 为每个容器对象生成唯一ID
        const containerIdMap = new WeakMap<Element, string>()
        let containerIdCounter = 0

        // 辅助函数：获取清理后的文本（带缓存）
        const getCleanedText = (text: string): string => {
            if (cleanedTextCache.has(text)) {
                return cleanedTextCache.get(text)
            }
            const cleaned = this.cleanPlaceholderTags(text, stayOriginalMap)
            cleanedTextCache.set(text, cleaned)
            return cleaned
        }

        // 辅助函数：获取容器的唯一ID
        const getUniqueContainerId = (container: Element): string => {
            if (!containerIdMap.has(container)) {
                containerIdMap.set(
                    container,
                    `container-${containerIdCounter++}`
                )
            }
            return containerIdMap.get(container)!
        }

        // 辅助函数：生成容器+文本的唯一键
        const getContainerTextKey = (
            container: Element,
            originText: string
        ): string => {
            // 优先使用 data-mewcat-parent-node-id，否则使用 WeakMap 生成的唯一ID
            const containerId =
                container.getAttribute("data-mewcat-parent-node-id") ||
                getUniqueContainerId(container)
            // 使用原始文本而不是清理后的文本，避免占位符清理导致的误判
            return `${containerId}::${originText}`
        }

        for (const node of nodes) {
            const container = node.container
            const text = node.originText
            // 清理占位符标签后的文本，用于去重比较（使用缓存）
            const cleanedText = getCleanedText(text)

            // 规则 1 快速检查：容器相同且原始文本相同则不输出
            // 注意：使用原始文本而不是清理后的文本，避免占位符清理导致的误判
            const containerTextKey = getContainerTextKey(container, text)
            if (containerTextMap.has(containerTextKey)) {
                continue // 跳过重复节点
            }

            let shouldSkip = false
            let replaceIndex = -1

            // 遍历已有结果，检查规则2和规则3
            // 注意：规则1已经通过 Map 快速检查，这里只需检查规则2和3
            for (let i = 0; i < result.length; i++) {
                const existingNode = result[i]
                const existingContainer = existingNode.container
                const existingText = existingNode.originText
                // 清理已存在节点的文本（使用缓存）
                const cleanedExistingText = getCleanedText(existingText)

                // 规则 2: Result节点容器包含当前节点容器，且Result文本包含当前文本则不输出
                if (
                    existingContainer.contains(container) &&
                    cleanedExistingText.includes(cleanedText)
                ) {
                    shouldSkip = true
                    break
                }

                // 规则 3: Result节点容器被当前节点容器包含，且当前文本包含Result文本则替换
                if (
                    container.contains(existingContainer) &&
                    cleanedText.includes(cleanedExistingText)
                ) {
                    replaceIndex = i
                    break
                }
            }

            if (shouldSkip) {
                continue
            }

            // 如果需要替换，则替换对应节点
            if (replaceIndex !== -1) {
                // 移除旧节点的 Map 记录
                const oldNode = result[replaceIndex]
                const oldCleanedText = getCleanedText(oldNode.originText)
                const oldKey = getContainerTextKey(
                    oldNode.container,
                    oldCleanedText
                )
                containerTextMap.delete(oldKey)

                // 替换节点
                result[replaceIndex] = node
            } else {
                // 否则添加到结果列表
                result.push(node)
            }

            // 记录到 Map 中（规则1优化）
            containerTextMap.set(containerTextKey, true)
            setTranslateUniqueId(container, node.id)
        }

        return result
    }

    /**
     * 更新URL（当页面URL变化时调用）
     * @param url 新的URL
     */
    public updateUrl(url: string): void {
        this.ruleEngine.updateUrl(url)
    }

    /**
     * 设置检测到的语言
     * @param language 检测到的语言代码
     */
    public setDetectedLanguage(language: string): void {
        this.detectedLanguage = language
    }

    /**
     * 检查节点是否应该被翻译（基于语言过滤规则）
     * @param node 翻译节点
     * @returns true 表示应该翻译，false 表示不应该翻译
     */
    private shouldTranslateNode(node: TranslationNode): boolean {
        if (!node.originText) {
            return false
        }
        if (this.manualTranslation) return true

        // 优化：如果没有配置语言过滤规则，直接返回 true
        if (
            (!this.alwaysTranslateLanguages ||
                this.alwaysTranslateLanguages.length === 0) &&
            (!this.neverTranslateLanguages ||
                this.neverTranslateLanguages.length === 0)
        ) {
            return true
        }

        // 使用缓存的 francCode，避免重复调用 franc
        const francCode = node.francCode ?? "und"

        // 如果检测失败（返回 'und'），默认允许翻译
        if (francCode === "und") {
            return true
        }

        // 优化：使用缓存避免重复调用 getEnhancedLanguageCode
        const cacheKey = `${francCode}:${node.originText.substring(0, 50)}`
        let detectedLang = this.languageCache.get(cacheKey)

        if (!detectedLang) {
            detectedLang = getEnhancedLanguageCode(francCode, node.originText)
            this.languageCache.set(cacheKey, detectedLang)
        }

        // 1. 检查 alwaysTranslateLanguages（优先级最高）
        if (
            this.alwaysTranslateLanguages &&
            this.alwaysTranslateLanguages.length > 0
        ) {
            // 如果在总是翻译列表中，允许翻译
            if (this.alwaysTranslateLanguages.includes(detectedLang)) {
                return true
            }
            // 如果不在总是翻译列表中，不翻译
            return false
        }

        // 2. 检查 neverTranslateLanguages
        if (
            this.neverTranslateLanguages &&
            this.neverTranslateLanguages.includes(detectedLang)
        ) {
            return false
        }

        // 3. 默认允许翻译
        return true
    }

    /**
     * 获取规则引擎
     */
    public getRuleEngine(): RuleEngine {
        return this.ruleEngine
    }

    /**
     * 根据可视性分类节点（优化版）
     * @param nodes 待分类的节点列表
     * @returns 分类后的可视和非可视节点
     */
    private classifyNodesByVisibility(nodes: TranslationNode[]): {
        visibleNodes: TranslationNode[]
        nonVisibleNodes: TranslationNode[]
    } {
        const visibleNodes: TranslationNode[] = []
        const nonVisibleNodes: TranslationNode[] = []

        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth

        // 优化1: 批量处理，减少重排
        // 使用 requestAnimationFrame 确保在渲染帧中执行
        for (const node of nodes) {
            const rect = node.container.getBoundingClientRect()
            const isInViewport =
                rect.top < viewportHeight &&
                rect.bottom > 0 &&
                rect.left < viewportWidth &&
                rect.right > 0

            if (isInViewport) {
                visibleNodes.push(node)
            } else {
                nonVisibleNodes.push(node)
            }
        }

        // 优化2: 使用更高效的排序方法
        // 节点已经在 DOM 遍历时按顺序收集，通常不需要重新排序
        // 如果需要排序，使用索引缓存避免重复调用 compareDocumentPosition
        const sortedVisible = this.sortNodesByDOMOrder(visibleNodes)
        const sortedNonVisible = this.sortNodesByDOMOrder(nonVisibleNodes)

        // 检查可视节点数量是否足够
        if (sortedVisible.length < this.minVisibleNodesThreshold) {
            // 合并并重新分配
            const allNodes = [...sortedVisible, ...sortedNonVisible]
            const visibleCount = Math.min(
                this.minVisibleNodesThreshold,
                allNodes.length
            )

            return {
                visibleNodes: allNodes.slice(0, visibleCount),
                nonVisibleNodes: allNodes.slice(visibleCount)
            }
        }

        return {
            visibleNodes: sortedVisible,
            nonVisibleNodes: sortedNonVisible
        }
    }

    /**
     * 根据 DOM 树顺序对节点进行排序（优化版）
     * @param nodes 待排序的节点列表
     * @returns 排序后的节点列表
     */
    private sortNodesByDOMOrder(nodes: TranslationNode[]): TranslationNode[] {
        if (nodes.length <= 1) {
            return nodes
        }

        // 优化: 使用缓存避免重复调用 compareDocumentPosition
        const positionCache = new Map<string, number>()

        const getPosition = (node: TranslationNode): number => {
            const lastNode = node.textNodes.at(-1)
            if (!lastNode) {
                return 0
            }

            const cacheKey = node.id
            if (positionCache.has(cacheKey)) {
                return positionCache.get(cacheKey)!
            }

            // 使用元素在文档中的位置作为排序依据
            // 这比 compareDocumentPosition 更快
            let position = 0
            let element: Element | null = lastNode.element
            while (element) {
                position++
                element = element.previousElementSibling
            }

            positionCache.set(cacheKey, position)
            return position
        }

        return nodes.sort((a, b) => {
            const aLastNode = a.textNodes.at(-1)
            const bLastNode = b.textNodes.at(-1)

            if (!aLastNode || !bLastNode) {
                return 0
            }

            // 优化: 先比较父元素，如果相同再比较位置
            if (
                aLastNode.element.parentElement ===
                bLastNode.element.parentElement
            ) {
                return getPosition(a) - getPosition(b)
            }

            // 不同父元素，使用 compareDocumentPosition
            const position = aLastNode.element.compareDocumentPosition(
                bLastNode.element
            )

            if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                return -1
            }
            if (position & Node.DOCUMENT_POSITION_PRECEDING) {
                return 1
            }

            return 0
        })
    }
}
