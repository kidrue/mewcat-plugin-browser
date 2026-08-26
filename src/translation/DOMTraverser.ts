import { nanoid } from "nanoid"
import { reduce } from "ramda"

import type { TranslationRule } from "@/types"
import { getCountWords } from "@/utils"
import { isDevelopment } from "@/utils/environment"

import { PerformanceMonitor } from "./PerformanceMonitor"

/**
 * 插入位置类型
 */
export enum InsertPosition {
    /** 在指定节点之后插入 */
    AFTER = "after",
    /** 在指定节点之前插入 */
    BEFORE = "before"
}
export interface TextNode {
    element: HTMLElement
    type: "text" | "stayOriginal"
    content: string
}
/** 翻译节点信息 */
export interface TranslationNode {
    id: string
    /** 父容器元素 - 翻译节点将插入到这个元素中 */
    container: HTMLElement
    /**  当前textNodes所含文本 */
    originText?: string
    /** 文本或不含块标签的行内标签节点 */
    textNodes?: TextNode[]
    /** 翻译文本 */
    translateText?: string
    /** 插入位置类型 */
    insertPosition: InsertPosition
    /** 添加标签类型 */
    insertTagType?: "br" | "nbsp"
    /** franc 语言代码 */
    francCode?: string
    /** 调试信息 */
    debugInfo?: {
        [key: string]: unknown
        //
        textNodeResultList?: FilterNodeResult[]
    }
}

/**
 * 过滤上下文
 * 在遍历过程中维护的状态信息
 */
interface FilterContext {
    rule: TranslationRule // 当前使用的规则
    currentMatchedContainer: Element | null
    // 当前匹配的容器元素（性能优化）
    // 用于缓存，避免重复调用 matches()
    stats: {
        totalNodes: number // 遍历的总节点数
        acceptedNodes: number // 接受的节点数
        rejectedNodes: number // 拒绝的节点数
        skippedNodes: number // 跳过的节点数
        stayOriginNodes: number // 跳过的节点数
    }
    // 🕐 性能监控：filterNode 各层检查的耗时统计
    filterNodeStats?: {
        totalCalls: number // 总调用次数
        layer0Time: number // Layer 0: 隐藏元素检查
        layer1Time: number // Layer 1: excludeSelectors
        layer2Time: number // Layer 2: selectors 白名单
        layer3Time: number // Layer 3: excludeTags
        layer4Time: number // Layer 4: stayOriginalSelectors
        layer5Time: number // Layer 5: stayOriginalTags
        layer5_5Time: number // Layer 5.5: ASIDE 特殊规则
        layer6Time: number // Layer 6: atomicBlockSelectors
        layer7Time: number // Layer 7: atomicBlockTags
        layer8Time: number // Layer 8: 内联标签
        layer9Time: number // Layer 9: 块级标签
        analyzeBlockTime: number // 🆕 analyzeBlockStructure 调用耗时
        validateRegexTime: number // 🆕 validateSelectorRegexes 调用耗时
    }
}

export interface FilterNodeResult {
    action: NodeAction
    reason: string
    layer: string
}

interface MathchesResult {
    mathches: boolean
    matchedSelector?: string
}

enum NodeAction {
    ACCEPT = "ACCEPT", // 1: 接受并处理当前节点
    REJECT = "REJECT", // 2: 拒绝节点及其子树
    SKIP = "SKIP", // 3: 跳过当前节点但处理子节点
    STAY_ORIGIN = "STAY_ORIGIN" // 4: 接受但保持原样
}
/**
 * DOM遍历器
 * 实现深度优先搜索(DFS)遍历策略
 * 严格按照 DOM_PROCESSING_LOGIC.md 的遍历策略设计
 */
export class DOMTraverser {
    private rule: TranslationRule
    private context: FilterContext
    private stayOriginalMap: Record<string, Element> = {}
    private stayOriginalCounter = 0 // 🕐 性能优化：避免 Object.keys().length
    private allBlocksTag = new Set<string>([])
    private compiledRegexps: {
        exclude: RegExp[]
        noTranslate: RegExp[]
        selectorRegexes: Map<string, RegExp[]>
    }

    /** 性能监控器（仅开发环境） */
    private performanceMonitor: PerformanceMonitor | null = null

    /** ⚡ 优化：isBlockElement 结果缓存 */
    private blockElementCache = new WeakMap<HTMLElement, boolean>()

    constructor(rule: TranslationRule) {
        this.rule = rule
        this.context = {
            rule: this.rule,
            currentMatchedContainer: null,
            stats: {
                totalNodes: 0,
                acceptedNodes: 0,
                rejectedNodes: 0,
                skippedNodes: 0,
                stayOriginNodes: 0
            },
            // 🕐 初始化 filterNode 性能统计
            filterNodeStats: {
                totalCalls: 0,
                layer0Time: 0,
                layer1Time: 0,
                layer2Time: 0,
                layer3Time: 0,
                layer4Time: 0,
                layer5Time: 0,
                layer5_5Time: 0,
                layer6Time: 0,
                layer7Time: 0,
                layer8Time: 0,
                layer9Time: 0,
                analyzeBlockTime: 0,
                validateRegexTime: 0
            }
        }
        this.compiledRegexps = this.compileRegexps()
        this.getBlockTags()

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
     * 遍历DOM树
     *
     * 新策略：聚合块级元素
     * - 识别块级容器（如 p, li, div 等）
     * - 收集容器内的所有文本作为一个翻译单元
     * - 返回容器元素而非碎片化的文本节点
     *
     * 性能优化：
     * - 缓存选择器匹配结果
     * - 提前终止不必要的检查
     * - 减少 DOM 操作次数
     *
     * @param rootElement 根元素
     * @returns 遍历结果数组（块级容器元素）
     */
    public traverse(rootElement: HTMLElement): {
        list: TranslationNode[]
        stayOriginalMap: Record<string, Element>
    } {
        // 🕐 开始性能监控
        this.performanceMonitor?.start("DOMTraverser.traverse")

        const perfStats = {
            traverseNodes: 0,
            filterNodeCalls: 0
        }

        const translateNodes: TranslationNode[] = []
        let lastNodeResult = null
        let lastTranslateNode: TranslationNode | null = null // 🕐 性能优化：缓存最后一个节点
        this.stayOriginalMap = {}
        this.stayOriginalCounter = 0 // 重置计数器

        // 递归遍历DOM树，查找块级容器
        const traverseNode = (node: Node) => {
            perfStats.traverseNodes++

            if (
                node.nodeType !== Node.ELEMENT_NODE &&
                node.nodeType !== Node.TEXT_NODE
            ) {
                return
            }
            const element = node as HTMLElement

            this.context.stats.totalNodes++

            // 检查是否应该被排除
            perfStats.filterNodeCalls++
            const filterResult = this.filterNode(element)
            // 提取 action（兼容调试模式返回的对象）
            const action =
                typeof filterResult === "object"
                    ? filterResult.action
                    : filterResult

            if (action === NodeAction.REJECT) {
                this.context.stats.rejectedNodes++
                lastNodeResult = action
                return // 跳过该元素及其子树
            }

            if (action === NodeAction.SKIP) {
                this.context.stats.skippedNodes++
                lastNodeResult = action
                // 🕐 性能优化：直接遍历 childNodes，避免 Array.from()
                const childNodes = element.childNodes
                for (let i = 0; i < childNodes.length; i++) {
                    traverseNode(childNodes[i])
                }
                return
            }

            if (action === NodeAction.STAY_ORIGIN) {
                this.context.stats.stayOriginNodes++
                // 🕐 性能优化：缓存 parentElement
                const parentElement = element.parentElement

                if (
                    lastTranslateNode &&
                    lastTranslateNode.container === parentElement &&
                    (lastNodeResult === NodeAction.ACCEPT ||
                        lastNodeResult === NodeAction.STAY_ORIGIN)
                ) {
                    // 🕐 性能优化：使用计数器代替 Object.keys().length
                    const id = `@${++this.stayOriginalCounter}#`
                    this.stayOriginalMap[id] = element
                    const textNode: TextNode = {
                        element: element,
                        content: id,
                        type: "stayOriginal"
                    }
                    lastTranslateNode.textNodes.push(textNode)
                    lastTranslateNode.debugInfo.textNodeResultList.push(
                        filterResult
                    )
                }

                lastNodeResult = action
                return // 跳过该元素及其子树
            }

            if (action === NodeAction.ACCEPT) {
                // 🕐 性能优化：缓存 parentElement
                const parentElement = element.parentElement

                // 🕐 性能优化：检查 lastTranslateNode 是否存在且与当前 parentElement 相同
                if (lastTranslateNode) {
                    if (lastTranslateNode.container === parentElement) {
                        // 创建 TextNode 对象
                        lastNodeResult = action
                        const textNode = this.createTextNode(element)
                        lastTranslateNode.textNodes.push(textNode)
                        lastTranslateNode.debugInfo.textNodeResultList.push(
                            filterResult
                        )
                        return
                    }
                }

                const nodeId =
                    parentElement.getAttribute("data-mewcat-parent-node-id") ||
                    nanoid()
                const textNode = this.createTextNode(element)
                const translateNode: TranslationNode = {
                    id: nodeId,
                    container: parentElement,
                    textNodes: [textNode],
                    insertPosition: InsertPosition.AFTER,
                    debugInfo: {
                        textNodeResultList: [filterResult]
                    }
                }

                this.context.stats.acceptedNodes++
                translateNodes.push(translateNode)
                lastTranslateNode = translateNode // 🕐 性能优化：更新缓存
                lastNodeResult = action
            }
        }

        // 🕐 DOM 遍历阶段
        this.performanceMonitor?.startStage("DOM遍历")
        if (this.rule.selectors.length > 0) {
            // 🕐 性能优化：避免 map + flat，直接收集节点
            const nodes: Node[] = []
            for (const selector of this.rule.selectors) {
                const nodeList = document.querySelectorAll(selector)
                for (let i = 0; i < nodeList.length; i++) {
                    nodes.push(nodeList[i])
                }
            }
            for (const node of nodes) {
                traverseNode(node)
            }
        } else {
            traverseNode(rootElement)
        }
        this.performanceMonitor?.endStage({
            traverseNodes: perfStats.traverseNodes,
            filterNodeCalls: perfStats.filterNodeCalls
        })

        // 🕐 添加 filterNode 详细统计子阶段
        const fnStats = this.context.filterNodeStats
        if (fnStats && this.performanceMonitor) {
            this.performanceMonitor.startStage("filterNode 详细统计")

            // 计算总耗时
            const fnTotalTime =
                fnStats.layer0Time +
                fnStats.layer1Time +
                fnStats.layer2Time +
                fnStats.layer3Time +
                fnStats.layer4Time +
                fnStats.layer5Time +
                fnStats.layer5_5Time +
                fnStats.layer6Time +
                fnStats.analyzeBlockTime +
                fnStats.validateRegexTime

            this.performanceMonitor.endStage({
                totalCalls: fnStats.totalCalls,
                totalTime: `${fnTotalTime.toFixed(2)}ms`,
                avgPerCall: `${(fnTotalTime / fnStats.totalCalls).toFixed(3)}ms`,
                layer0_隐藏元素: `${fnStats.layer0Time.toFixed(2)}ms`,
                layer1_excludeSelectors: `${fnStats.layer1Time.toFixed(2)}ms`,
                layer2_selectors白名单: `${fnStats.layer2Time.toFixed(2)}ms`,
                layer3_excludeTags: `${fnStats.layer3Time.toFixed(2)}ms`,
                layer4_stayOriginalSelectors: `${fnStats.layer4Time.toFixed(2)}ms`,
                layer5_stayOriginalTags: `${fnStats.layer5Time.toFixed(2)}ms`,
                layer5_5_ASIDE特殊规则: `${fnStats.layer5_5Time.toFixed(2)}ms`,
                layer6_atomicBlockSelectors: `${fnStats.layer6Time.toFixed(2)}ms`,
                analyzeBlock: `${fnStats.analyzeBlockTime.toFixed(2)}ms`,
                validateRegex: `${fnStats.validateRegexTime.toFixed(2)}ms`
            })
        }

        // 🕐 文本处理阶段
        this.performanceMonitor?.startStage("文本处理")

        const result = reduce<TranslationNode, TranslationNode[]>(
            (p, c) => {
                const text = this.extractTranslateBlocksText(c)?.trim?.()
                if (text) {
                    const { total } = getCountWords(text)

                    return [
                        ...p,
                        {
                            ...c,
                            originText: text,
                            insertTagType:
                                this.rule.blockMinTextCount < text.length ||
                                this.rule.blockMinWordCount < total
                                    ? "br"
                                    : "nbsp"
                        }
                    ]
                }
                return p
            },
            [],
            translateNodes
        )

        this.performanceMonitor?.endStage({
            originalNodes: translateNodes.length,
            finalNodes: result.length
        })

        // 🕐 结束性能监控
        this.performanceMonitor?.end({
            totalNodes: this.context.stats.totalNodes,
            acceptedNodes: this.context.stats.acceptedNodes,
            rejectedNodes: this.context.stats.rejectedNodes,
            skippedNodes: this.context.stats.skippedNodes,
            stayOriginNodes: this.context.stats.stayOriginNodes,
            originalTranslateNodes: translateNodes.length,
            finalTranslateNodes: result.length
        })

        return {
            list: result,
            stayOriginalMap: this.stayOriginalMap
        }
    }

    /**
     * 创建 TextNode 对象
     * 检测元素类型，如果是 a 标签则标记为 link 类型
     */
    private createTextNode(element: HTMLElement): TextNode {
        return {
            element,
            type: "text",
            content: element.textContent?.trim() || ""
        }
    }

    /**
     * 提取块级元素的文本内容
     *
     * 策略：
     * 1. 递归收集所有可见文本节点
     * 2. 跳过排除的子元素
     * 3. 应用 noTranslateRegexp 过滤不符合要求的文本节点
     * 4. 聚合成完整的文本内容
     *
     * @param element 块级元素
     * @returns 翻译节点信息（如果通过验证）
     */
    private extractTranslateBlocksText(node: TranslationNode): string | null {
        // 聚合文本内容
        const textList: string[] = []
        const traverseNode = (node: Node) => {
            if (
                node.nodeType === Node.ELEMENT_NODE &&
                this.rule.preserveTagsInTranslation.includes(
                    (node as Element).tagName
                )
            ) {
                const tag = `${(node as Element).tagName.toLowerCase()}${Object.keys(this.stayOriginalMap).length + 1}`
                this.stayOriginalMap[`${tag}`] = node as Element
                const newText = `<${tag}>${node.textContent.trim()}</${tag}>`
                textList.push(newText)
                return
            }
            if (node.nodeType === Node.TEXT_NODE) {
                const textContent = node.textContent?.trim() || ""
                // 跳过空文本
                if (!textContent) {
                    return
                }

                textList.push(textContent)
                return
            }
            const isExclude = this.isExcludeNode(node)
            if (isExclude) {
                return
            }
            for (const child of Array.from(node.childNodes)) {
                traverseNode(child)
            }
        }
        for (const textNode of node.textNodes) {
            if (textNode.type === "stayOriginal") {
                textList.push(textNode.content.trim())
            }
            if (textNode.type === "text") {
                traverseNode(textNode.element)
            }
        }

        const fullText = textList.join("")
        // 验证文本
        if (!this.validateText(fullText)) {
            return null
        }

        if (this.shouldSkipTextByNoTranslateRegexp(fullText)) {
            return null
        }

        if (!fullText.trim()) {
            return null
        }

        return fullText.trim()
    }

    /**
     * 检查文本是否应该被 noTranslateRegexp 跳过
     *
     * @param text 要检查的文本
     * @returns true 表示应该跳过，false 表示可以翻译
     */
    private shouldSkipTextByNoTranslateRegexp(text: string): boolean {
        // 遍历所有 noTranslateRegexp 正则表达式
        for (const regex of this.compiledRegexps.noTranslate) {
            if (regex.test(text)) {
                return true // 匹配不翻译正则，应该跳过
            }
        }
        return false // 未匹配，可以翻译
    }

    private isExcludeNode(node: Node): boolean {
        const element = node as Element
        if (this.matchesExcludeSelectors(element).mathches) {
            return true
        }
        if (this.rule.excludeTags?.includes(element?.tagName)) {
            return true
        }
        return false
    }
    /**
     * 获取块级标签列表
     * @returns 块级标签数组
     */
    private getBlockTags() {
        // 默认的块级标签列表
        const defaultBlockTags = new Set([
            "P",
            "DIV",
            "LI",
            "H1",
            "H2",
            "H3",
            "H4",
            "H5",
            "H6",
            "SECTION",
            "ARTICLE",
            "HEADER",
            "FOOTER",
            "BLOCKQUOTE",
            "TD",
            "TH",
            "DD",
            "DT",
            "FIGCAPTION",
            "SUMMARY",
            "LABEL"
        ])

        this.rule.allBlockTags.forEach(tag => {
            defaultBlockTags.add(tag.toUpperCase())
        })

        this.allBlocksTag = defaultBlockTags

        // 去重
        return defaultBlockTags
    }

    /**
     * 判断元素是否为块级元素（结合 HTML 标签和 CSS 样式）
     *
     * 检查策略（按优先级，已优化）：
     * 1. 检查缓存（最快）
     * 2. BR 标签快速返回
     * 3. 默认块级标签检查（快速路径）
     * 4. 选择器匹配（中等速度）
     * 5. CSS display 属性（最慢，最后检查）
     *
     * @param element 要检查的元素
     * @returns 是否为块级元素
     */
    public isBlockElement(element: HTMLElement): boolean {
        if (!element || !element?.tagName) {
            return false
        }

        // ⚡ 优化 1: 检查缓存
        if (this.blockElementCache.has(element)) {
            return this.blockElementCache.get(element)!
        }

        const tagName = element?.tagName?.toUpperCase()

        // ⚡ 优化 4: 快速路径 - 检查默认块级标签（避免 getComputedStyle）
        if (this.allBlocksTag.has(tagName)) {
            // 只有在标签是块级时，才检查 CSS 是否覆盖为内联
            try {
                const computedStyle = window.getComputedStyle(element)
                const display = computedStyle.display

                // 明确的内联 display 属性
                const INLINE_DISPLAY_VALUES = new Set([
                    "inline",
                    "inline-flex",
                    "inline-grid",
                    "contents",
                    "none"
                ])

                if (INLINE_DISPLAY_VALUES.has(display)) {
                    this.blockElementCache.set(element, false)
                    return false
                }
            } catch {
                // getComputedStyle 失败，使用标签默认行为
            }
            this.blockElementCache.set(element, true)
            return true
        }

        // 1. 检查是否是原子块选择器
        if (this.matchesAtomicBlockSelectors(element).mathches) {
            this.blockElementCache.set(element, true)
            return true
        }

        // 2. 检查 extraInlineSelectors 和 extraBlockSelectors
        if (this.matchesExtraInlineSelectors(element).mathches) {
            this.blockElementCache.set(element, false)
            return false
        }

        if (this.matchesExtraBlockSelectors(element).mathches) {
            this.blockElementCache.set(element, true)
            return true
        }

        // 3. 最后才检查 CSS display 属性（最慢）
        try {
            const computedStyle = window.getComputedStyle(element)
            const display = computedStyle.display

            // 块级 display 属性
            const BLOCK_DISPLAY_VALUES = new Set([
                "block",
                "inline-block",
                "flex",
                "grid",
                "table",
                "table-row",
                "table-cell",
                "list-item",
                "flow-root"
            ])

            if (BLOCK_DISPLAY_VALUES.has(display)) {
                this.blockElementCache.set(element, true)
                return true
            }

            // 明确的内联 display 属性
            const INLINE_DISPLAY_VALUES = new Set([
                "inline",
                "inline-block",
                "inline-flex",
                "inline-grid",
                "contents",
                "none"
            ])
            if (INLINE_DISPLAY_VALUES.has(display)) {
                this.blockElementCache.set(element, false)
                return false
            }
        } catch (error) {
            // getComputedStyle 可能在某些情况下失败，继续检查标签
            console.warn(
                "[DOMTraverser] getComputedStyle 失败，降级到标签检查:",
                error
            )
        }

        // 默认返回 false
        this.blockElementCache.set(element, false)
        return false
    }

    /**
     * 判断元素自身或其子元素是否包含块级元素（已优化）
     *
     * 优化点：
     * 1. 使用 isBlockElement 缓存避免重复计算
     * 2. 早期退出：找到第一个块级子元素即可返回（如果不需要精确计数）
     * 3. 限制遍历深度为 3，避免过度深入
     *
     * 应用场景：
     * - 决定是否应该将元素作为一个整体翻译单元
     * - 如果包含块级子元素，可能需要拆分处理
     *
     * @param element 要检查的元素
     * @param needCount 是否需要精确的块级子元素计数（默认 false）
     * @param maxDepth 最大遍历深度（默认 3）
     * @returns { isSelfBlock: boolean, hasBlockChildren: boolean, blockChildrenCount: number }
     */
    public analyzeBlockStructure(
        element: HTMLElement,
        needCount: boolean = false,
        maxDepth: number = 3
    ): {
        isSelfBlock: boolean
        hasBlockChildren: boolean
        blockChildrenCount: number
    } {
        // 检查自身是否为块级元素（使用缓存）
        const isSelfBlock = this.isBlockElement(element)

        // 检查子元素
        let hasBlockChildren = false
        let blockChildrenCount = 0

        const stack: Array<{ element: HTMLElement; depth: number }> = [
            { element, depth: 0 }
        ]

        // ⚡ 优化 3: 限制深度遍历
        while (stack.length > 0) {
            const { element: parent, depth } = stack.pop()!

            // 深度限制
            if (depth >= maxDepth) {
                continue
            }

            // 直接访问 children 属性，它是一个 Live Collection
            const children = parent.children
            const len = children.length

            // 倒序遍历并入栈
            for (let i = len - 1; i >= 0; i--) {
                const child = children[i] as HTMLElement

                // 基础类型检查
                if (!child.tagName) {
                    continue
                }

                // 排除逻辑：如果匹配排除选择器，直接跳过该分支
                if (this.matchesExcludeSelectors(child).mathches) {
                    continue
                }

                // 检查是否为块级元素（使用缓存）
                if (this.isBlockElement(child)) {
                    hasBlockChildren = true
                    blockChildrenCount++

                    // ⚡ 优化 2: 早期退出
                    if (!needCount) {
                        return {
                            isSelfBlock,
                            hasBlockChildren: true,
                            blockChildrenCount: 1
                        }
                    }
                }

                // 只有当有子元素时才入栈
                if (child.children.length > 0) {
                    stack.push({ element: child, depth: depth + 1 })
                }
            }
        }

        return {
            isSelfBlock,
            hasBlockChildren,
            blockChildrenCount
        }
    }

    /**
     * 核心节点过滤决策函数
     * @param node 当前节点
     * @returns NodeAction (ACCEPT/REJECT/SKIP) 或带调试信息的对象
     */
    private filterNode(node: Node): FilterNodeResult {
        const element = node as HTMLElement
        const tagName = element?.tagName?.toUpperCase()

        // 辅助函数：返回结果（带调试信息）
        const returnResult = (
            action: NodeAction,
            reason: string,
            layer: string
        ) => {
            return { action, reason, layer }
        }

        // 🕐 性能监控：记录总调用次数
        if (this.context.filterNodeStats) {
            this.context.filterNodeStats.totalCalls++
        }

        // 只处理元素节点和文本节点
        if (
            node.nodeType !== Node.ELEMENT_NODE &&
            node.nodeType !== Node.TEXT_NODE
        ) {
            return returnResult(
                NodeAction.REJECT,
                `非元素节点和文本节点 (nodeType: ${node.nodeType})`,
                "Pre-check"
            )
        }

        // 文本节点直接接受（由父元素决定是否处理）
        if (node.nodeType === Node.TEXT_NODE) {
            return returnResult(
                NodeAction.ACCEPT,
                `文本节点: "${node.textContent?.trim().substring(0, 50)}..."`,
                "Pre-check"
            )
        }

        // ====================================
        // Layer 0: BR 标签连续检查（快速路径）
        // ====================================
        if (tagName === "BR") {
            // 检查前一个兄弟节点
            const prevSibling = element.previousElementSibling
            if (prevSibling?.tagName === "BR") {
                this.context.stats.rejectedNodes++
                return returnResult(
                    NodeAction.REJECT,
                    `连续 BR 标签（前一个是 BR）`,
                    "Layer 0 - BR Check"
                )
            }

            // 检查后一个兄弟节点
            const nextSibling = element.nextElementSibling
            if (nextSibling?.tagName === "BR") {
                this.context.stats.rejectedNodes++
                return returnResult(
                    NodeAction.REJECT,
                    `连续 BR 标签（后一个是 BR）`,
                    "Layer 0 - BR Check"
                )
            }
        }

        // ====================================
        // Layer 0: 隐藏元素检查
        // ====================================
        const layer0Start = performance.now()
        const isHidden = this.isHiddenElement(element)
        if (this.context.filterNodeStats) {
            this.context.filterNodeStats.layer0Time +=
                performance.now() - layer0Start
        }
        if (isHidden) {
            this.context.stats.rejectedNodes++
            return returnResult(
                NodeAction.REJECT,
                `隐藏元素 (${tagName})`,
                "Layer 0"
            )
        }

        // ====================================
        // Layer 1: excludeSelectors 检查
        // ====================================
        const layer1Start = performance.now()
        const matchesExclude = this.matchesExcludeSelectors(element)
        if (this.context.filterNodeStats) {
            this.context.filterNodeStats.layer1Time +=
                performance.now() - layer1Start
        }
        if (matchesExclude.mathches) {
            this.context.stats.rejectedNodes++
            return returnResult(
                NodeAction.REJECT,
                `匹配 excludeSelectors (${tagName}), 选择器: ${matchesExclude.matchedSelector})`,
                "Layer 1"
            )
        }

        // ====================================
        // Layer 2: selectors 白名单检查
        // ====================================
        const layer2Start = performance.now()
        const selectorCheckResult = this.checkSelectors(element)
        if (this.context.filterNodeStats) {
            this.context.filterNodeStats.layer2Time +=
                performance.now() - layer2Start
        }
        if (selectorCheckResult.action === "REJECT") {
            this.context.stats.rejectedNodes++
            return returnResult(
                NodeAction.REJECT,
                `不在 selectors 白名单中 (${tagName}), 选择器: ${selectorCheckResult.matchedSelector})`,
                "Layer 2"
            )
        }

        // ====================================
        // Layer 3: excludeTags 检查
        // ====================================
        const layer3Start = performance.now()
        const matchesExcludeTags = this.rule.excludeTags?.includes(tagName)
        if (this.context.filterNodeStats) {
            this.context.filterNodeStats.layer3Time +=
                performance.now() - layer3Start
        }
        if (matchesExcludeTags) {
            this.context.stats.rejectedNodes++
            return returnResult(
                NodeAction.REJECT,
                `匹配 excludeTags (${tagName}), 选择器: ${this.rule.excludeTags?.join(", ")}`,
                "Layer 3"
            )
        }

        // ====================================
        // Layer 4: stayOriginalSelectors 检查
        // ====================================
        const layer4Start = performance.now()
        const matchesStayOriginal = this.matchesStayOriginalSelectors(element)
        if (this.context.filterNodeStats) {
            this.context.filterNodeStats.layer4Time +=
                performance.now() - layer4Start
        }
        if (matchesStayOriginal.mathches) {
            this.context.stats.stayOriginNodes++
            return returnResult(
                NodeAction.STAY_ORIGIN,
                `匹配 stayOriginalSelectors (${tagName}), 选择器: ${matchesStayOriginal.matchedSelector})`,
                "Layer 4"
            )
        }

        // ====================================
        // Layer 5: stayOriginalTags 检查
        // ====================================
        const layer5Start = performance.now()
        const matchesStayOriginalTags =
            this.rule.stayOriginalTags?.includes(tagName)
        if (this.context.filterNodeStats) {
            this.context.filterNodeStats.layer5Time +=
                performance.now() - layer5Start
        }
        if (matchesStayOriginalTags) {
            this.context.stats.stayOriginNodes++
            return returnResult(
                NodeAction.STAY_ORIGIN,
                `匹配 stayOriginalTags (${tagName}), 选择器: ${this.rule.stayOriginalTags?.join(", ")})`,
                "Layer 5"
            )
        }

        // ====================================
        // Layer 5.5: ASIDE 标签特殊规则检查
        // ====================================
        if (tagName === "ASIDE") {
            const layer5_5Start = performance.now()
            const asideDecision = this.checkAsideElement(element)
            if (this.context.filterNodeStats) {
                this.context.filterNodeStats.layer5_5Time +=
                    performance.now() - layer5_5Start
            }
            if (asideDecision !== null) {
                if (asideDecision === NodeAction.REJECT) {
                    this.context.stats.rejectedNodes++
                    return returnResult(
                        NodeAction.REJECT,
                        `ASIDE 标签特殊规则 (内容过多或无长段落)`,
                        "Layer 5.5"
                    )
                }
                return returnResult(
                    asideDecision,
                    "ASIDE 标签特殊规则 (有长段落)",
                    "Layer 5.5"
                )
            }
            // asideDecision === null 表示继续正常流程
        }

        // ====================================
        // Layer 6: atomicBlockSelectors 检查
        // ====================================
        const layer6Start = performance.now()
        const matchesAtomicBlock = this.matchesAtomicBlockSelectors(element)
        if (this.context.filterNodeStats) {
            this.context.filterNodeStats.layer6Time +=
                performance.now() - layer6Start
        }
        if (matchesAtomicBlock.mathches) {
            this.context.stats.acceptedNodes++
            return returnResult(
                NodeAction.SKIP,
                `匹配 atomicBlockSelectors (${tagName}), 选择器: ${matchesAtomicBlock.matchedSelector})`,
                "Layer 6"
            )
        }

        // ====================================
        // analyzeBlockStructure 调用（未分层的关键逻辑）
        // ====================================
        const analyzeBlockStart = performance.now()
        const { hasBlockChildren, isSelfBlock } =
            this.analyzeBlockStructure(element)
        if (this.context.filterNodeStats) {
            this.context.filterNodeStats.analyzeBlockTime +=
                performance.now() - analyzeBlockStart
        }

        if (!hasBlockChildren) {
            if (isSelfBlock) {
                this.context.stats.skippedNodes++
                return returnResult(
                    NodeAction.SKIP,
                    `无块级子元素且自身是块级元素 (${tagName})`,
                    "Block Analysis"
                )
            }
            return returnResult(
                NodeAction.ACCEPT,
                `无块级子元素且自身不是块级元素 (${tagName})`,
                "Block Analysis"
            )
        }

        // ====================================
        // validateSelectorRegexes 调用（未分层的关键逻辑）
        // ====================================
        if (element.nodeType === Node.ELEMENT_NODE) {
            const validateRegexStart = performance.now()
            const isValid = this.validateSelectorRegexes(element)
            if (this.context.filterNodeStats) {
                this.context.filterNodeStats.validateRegexTime +=
                    performance.now() - validateRegexStart
            }
            if (!isValid) {
                return returnResult(
                    NodeAction.REJECT,
                    `未通过 validateSelectorRegexes 检查 (${tagName})`,
                    "Regex Validation"
                )
            }
        }

        this.context.stats.skippedNodes++
        return returnResult(
            NodeAction.SKIP,
            `有块级子元素，跳过当前节点处理子节点 (${tagName})`,
            "Final"
        )
    }

    /**
     * 文本验证
     * @param text 文本内容
     * @param element 父元素
     * @param debug 是否启用调试模式
     * @returns 是否通过验证 或 { passed: boolean, reason: string, step: string }
     */
    private validateText(
        text: string,
        debug = false
    ): boolean | { passed: boolean; reason: string; step: string } {
        // 辅助函数：返回结果（带调试信息）
        const returnResult = (
            passed: boolean,
            reason: string,
            step: string
        ) => {
            if (debug) {
                console.log(
                    `[validateText] ${passed ? "✅ PASS" : "❌ FAIL"} - ${step}: ${reason}`,
                    `文本: "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`
                )
                return { passed, reason, step }
            }
            return passed
        }

        // ====================================
        // 步骤1: 长度检查
        // ====================================
        const minLength = this.rule.paragraphMinTextCount || 2
        if (text.length < minLength) {
            return returnResult(
                false,
                `文本太短 (${text.length} < ${minLength})`,
                "步骤1: 长度检查"
            )
        }

        // ====================================
        // 步骤2: 单词数检查（支持无空格语言）
        // ====================================
        // 检测是否包含 CJK 字符（中文、日文、韩文）或泰语等无空格语言
        const hasCJK =
            /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/u.test(text)
        const hasThai = /[\u0e00-\u0e7f]/u.test(text) // 泰语 Unicode 范围
        const hasKhmer = /[\u1780-\u17ff]/u.test(text) // 高棉语 Unicode 范围
        const hasLao = /[\u0e80-\u0eff]/u.test(text) // 老挝语 Unicode 范围
        const hasMyanmar = /[\u1000-\u109f]/u.test(text) // 缅甸语 Unicode 范围

        // 对于无空格语言，跳过单词数检查
        const isSpacelessLanguage =
            hasCJK || hasThai || hasKhmer || hasLao || hasMyanmar

        if (!isSpacelessLanguage) {
            // 对于有空格的语言（如英语、法语等），检查单词数
            const words = text.match(/\b\w+\b/g) || []
            // const minWords = this.rule.paragraphMinWordCount || 1
            const minWords = 1
            if (words.length < minWords) {
                return returnResult(
                    false,
                    `单词太少 (${words.length} < ${minWords}), 单词: [${words.join(", ")}]`,
                    "步骤2: 单词数检查"
                )
            }
        }

        // ====================================
        // 步骤3: 正则排除检查
        // ====================================
        for (let i = 0; i < this.compiledRegexps.exclude.length; i++) {
            const regex = this.compiledRegexps.exclude[i]
            if (regex.test(text)) {
                return returnResult(
                    false,
                    `匹配排除正则 #${i}: ${regex.source}`,
                    "步骤3: 正则排除检查"
                )
            }
        }

        // ====================================
        // 步骤4: 不翻译内容检查
        // ====================================
        for (let i = 0; i < this.compiledRegexps.noTranslate.length; i++) {
            const regex = this.compiledRegexps.noTranslate[i]
            if (regex.test(text)) {
                return returnResult(
                    false,
                    `匹配不翻译正则 #${i}: ${regex.source}`,
                    "步骤4: 不翻译内容检查"
                )
            }
        }

        // ====================================
        // 步骤5: 零宽字符检查
        // ====================================
        // eslint-disable-next-line no-misleading-character-class
        const zeroWidthRegex = /[\u200B\u200C\u200D\uFEFF]|\u2060/g
        if (text.replace(zeroWidthRegex, "").length === 0) {
            return false // 只包含零宽字符
        }

        // ====================================
        // 步骤6: 特殊内容类型检查（不需要翻译的内容）
        // ====================================
        const trimmedText = text.trim()

        // 6.1 纯数字（包括带千分位、小数点、负号的数字）
        // 例如: "123", "1,234.56", "-99.99", "1,000,000"
        if (/^[+-]?[\d,]+\.?\d*$/.test(trimmedText)) {
            return false
        }

        // 6.2 电话号码（支持多种格式）
        // 例如: "+1-234-567-8900", "(123) 456-7890", "123.456.7890", "+86 138 0000 0000"
        const phoneRegex =
            /^[+]?[(]?\d{1,4}[)]?[-.\s]?[(]?\d{1,4}[)]?[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/
        if (phoneRegex.test(trimmedText)) {
            return false
        }

        // 6.3 邮箱地址
        // 例如: "user@example.com", "name.surname@company.co.uk"
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        if (emailRegex.test(trimmedText)) {
            return false
        }

        // 6.4 URL 地址
        // 例如: "https://example.com", "www.example.com", "example.com/path"
        const urlRegex =
            /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/
        if (urlRegex.test(trimmedText)) {
            return false
        }

        // 6.5 日期时间格式
        // 例如: "2024-01-30", "01/30/2024", "2024-01-30 14:30:00", "14:30:00"
        const dateTimeRegex =
            /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})(\s+\d{1,2}:\d{2}(:\d{2})?)?$|^\d{1,2}:\d{2}(:\d{2})?$/
        if (dateTimeRegex.test(trimmedText)) {
            return false
        }

        // 6.6 版本号
        // 例如: "v1.0.0", "1.2.3", "2.0.0-beta.1"
        const versionRegex = /^v?\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/
        if (versionRegex.test(trimmedText)) {
            return false
        }

        // 6.7 货币金额（带货币符号）
        // 例如: "$123.45", "€1,234.56", "¥1000", "£99.99"
        const currencyRegex = /^[¥$€£₹₽¢][\d,]+\.?\d*$|^[\d,]+\.?\d*[¥$€£₹₽¢]$/
        if (currencyRegex.test(trimmedText)) {
            return false
        }

        // 6.8 百分比
        // 例如: "50%", "99.9%", "-10%"
        if (/^[+-]?\d+\.?\d*%$/.test(trimmedText)) {
            return false
        }

        // 6.9 IP 地址（IPv4 和 IPv6）
        // 例如: "192.168.1.1", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
        const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/
        if (ipv4Regex.test(trimmedText) || ipv6Regex.test(trimmedText)) {
            return false
        }

        // 6.10 哈希值（MD5, SHA等）
        // 例如: "5d41402abc4b2a76b9719d911017c592" (MD5)
        if (/^[a-fA-F0-9]{32,64}$/.test(trimmedText)) {
            return false
        }

        // 6.11 UUID
        // 例如: "550e8400-e29b-41d4-a716-446655440000"
        const uuidRegex =
            /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        if (uuidRegex.test(trimmedText)) {
            return false
        }

        // 6.12 纯符号（只包含标点符号、空格、特殊字符）
        // 例如: "...", "---", "***", ">>>"
        if (/^[\s\p{P}\p{S}]+$/u.test(trimmedText)) {
            return false
        }

        return true // 通过所有验证
    }

    /**
     * 选择器正则验证
     *
     * 例如：表格单元格中的特殊内容排除
     *
     * @param text 文本内容
     * @param element 父元素
     * @returns 是否通过验证
     */
    private validateSelectorRegexes(element: Element): boolean {
        for (const [selector, regexps] of this.compiledRegexps
            .selectorRegexes) {
            // 检查元素是否匹配选择器
            if (element.matches(selector)) {
                // 检查文本是否匹配任一正则
                for (const regex of regexps) {
                    if (regex.test(element.textContent)) {
                        return false // 匹配排除正则，不翻译
                    }
                }
            }
        }
        return true
    }

    /**
     * 检查元素是否隐藏
     * 隐藏的元素不需要翻译，可以提高性能
     *
     * 检查的隐藏方式：
     * 1. display: none
     * 2. visibility: hidden
     * 3. opacity: 0
     * 4. hidden 属性
     * 5. aria-hidden="true"
     * 6. 元素尺寸为 0（宽度或高度为 0）
     * 7. 脱离文档流的元素（position: fixed/absolute 且不在视口内）
     * 8. clip/clip-path 裁剪为 0
     * 9. transform: scale(0) 缩放为 0
     *
     * 性能优化：
     * - 优先检查轻量级属性（hidden, aria-hidden）
     * - 延迟调用昂贵的 getComputedStyle 和 getBoundingClientRect
     * - 使用短路逻辑提前返回
     *
     * @param element 要检查的元素
     * @returns 是否隐藏
     */
    private isHiddenElement(element: HTMLElement): boolean {
        // 优先检查轻量级属性（不需要样式计算）
        // 检查 hidden 属性
        if (element.hasAttribute("hidden")) {
            return true
        }

        // 检查 aria-hidden
        // if (element.getAttribute("aria-hidden") === "true") {
        //     return true
        // }

        // 延迟调用昂贵的 getComputedStyle（触发样式计算）
        const style = window.getComputedStyle(element)

        // 检查 display: none（最常见的隐藏方式，优先检查）
        if (style.display === "none") {
            return true
        }

        // 检查 visibility: hidden
        if (style.visibility === "hidden") {
            return true
        }

        // 检查 opacity: 0
        if (style.opacity === "0") {
            return true
        }

        // 检查元素尺寸（触发布局计算）
        const rect = element.getBoundingClientRect()

        // 检查 display: contents（特殊情况：元素盒子被移除，但子元素正常渲染）
        // display: contents 的元素宽高为0，但不应被视为隐藏
        if (style.display === "contents") {
            return false // 不是隐藏的，子元素会正常显示
        }

        // 检查元素是否脱离文档流
        const position = style.position

        // 对于脱离文档流的元素（fixed, absolute），需要特殊处理
        if (position === "fixed" || position === "absolute") {
            // 1. 检查是否有尺寸（脱离文档流的元素可能宽高为0但仍然可见）
            // 如果元素有明确的宽高设置，即使为0也可能是有意为之
            const hasExplicitSize =
                style.width !== "auto" || style.height !== "auto"

            // 2. 检查是否在视口内（脱离文档流的元素可能在视口外）
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            // 元素完全在视口外
            const isOutsideViewport =
                rect.right < 0 ||
                rect.bottom < 0 ||
                rect.left > viewportWidth ||
                rect.top > viewportHeight

            // 如果元素在视口外且没有明确的尺寸设置，认为是隐藏的
            if (isOutsideViewport && !hasExplicitSize) {
                return true
            }

            // 如果元素宽高都为0且没有明确的尺寸设置，认为是隐藏的
            if (rect.width === 0 && rect.height === 0 && !hasExplicitSize) {
                return true
            }
        } else {
            // 对于正常文档流中的元素，宽高为0则认为是隐藏的
            if (rect.width === 0 && rect.height === 0) {
                return true
            }
        }

        // 检查 clip 和 clip-path（可能用于隐藏元素）
        // 注意：clip 属性已弃用，但仍被广泛使用
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clipValue = (style as any).clip
        if (clipValue === "rect(0px, 0px, 0px, 0px)") {
            return true
        }

        // 检查 transform: scale(0)（缩放为0）
        const transform = style.transform
        if (
            transform &&
            (transform.includes("scale(0)") ||
                transform.includes("scale(0, 0)"))
        ) {
            return true
        }

        return false
    }

    /**
     * 检查是否匹配排除选择器
     * @param element 元素节点
     * @returns 是否匹配排除选择器
     */
    private matchesExcludeSelectors(element: Element): MathchesResult {
        const excludeSelectors = [
            ...(this.rule.excludeSelectors || []),
            ...(this.rule.mutationExcludeSelectors || []),
            ...this.rule.additionalExcludeSelectors
        ]

        return this.matchesAnySelector(element, excludeSelectors)
    }

    /**
     * 检查元素是否匹配任一选择器
     *
     * 性能优化：
     * - 提前检查空数组和无效元素
     * - 缓存选择器数组长度
     * - 使用 try-catch 只包裹可能出错的代码
     *
     * @param element 元素节点
     * @param selectors 选择器数组
     * @returns 是否匹配
     */
    private matchesAnySelector(
        element: Element,
        selectors: string[]
    ): MathchesResult {
        // 提前返回：空选择器数组
        if (!selectors || selectors.length === 0) {
            return { mathches: false }
        }

        // 提前返回：无效元素
        if (!element || element.nodeType === Node.COMMENT_NODE) {
            return { mathches: false }
        }

        // 缓存数组长度，避免重复访问
        const length = selectors.length
        for (let i = 0; i < length; i++) {
            const selector = selectors[i]
            try {
                if (element.matches(selector)) {
                    return { mathches: true, matchedSelector: selector } // 找到匹配，立即返回
                }
            } catch (e) {
                // 只在出错时打印警告，避免影响性能
                console.warn(`[DOMTranslator] 无效的选择器: ${selector}`, e)
            }
        }

        return { mathches: false }
    }
    /**
     * 检查 selectors 白名单
     *
     * 核心逻辑：
     * - selectors 为空 [] → 全页面模式，不限制
     * - selectors 非空：
     *   - 当前节点匹配 → CONTINUE，更新 currentMatchedContainer
     *   - 当前节点在已匹配容器内 → CONTINUE（缓存优化）
     *   - 都不满足 → REJECT（不在白名单）
     *
     * @param element 元素节点
     * @returns 'CONTINUE' | 'REJECT'
     */
    private checkSelectors(element: Element): {
        action: "CONTINUE" | "REJECT"
        matchedSelector?: string
    } {
        const selectors = this.rule.selectors || []
        // 情况1: selectors 为空，全页面模式
        if (selectors.length === 0) {
            return { action: "CONTINUE" }
        }

        // 情况2: 检查缓存，是否在已匹配的容器内
        if (this.context.currentMatchedContainer) {
            if (this.context.currentMatchedContainer.contains(element)) {
                return { action: "CONTINUE" } // 在容器内，直接通过
            }
            // 已离开之前匹配的容器，重置缓存
            this.context.currentMatchedContainer = null
        }

        // 情况3: 检查当前节点是否匹配 selectors
        const matches = this.matchesAnySelector(element, selectors)
        if (matches.mathches) {
            // 更新匹配的容器缓存
            this.context.currentMatchedContainer = element
            return {
                action: "CONTINUE",
                matchedSelector: matches.matchedSelector
            }
        }

        // 情况4: 检查 additionalSelectors（补充选择器）
        if (
            this.matchesAnySelector(
                element,
                this.rule.additionalSelectors || []
            )
        ) {
            return { action: "CONTINUE" }
        }

        // 不匹配任何选择器，拒绝
        return { action: "REJECT" }
    }

    private matchesStayOriginalSelectors(element: Element): MathchesResult {
        return this.matchesAnySelector(
            element,
            this.rule.stayOriginalSelectors || []
        )
    }

    private matchesAtomicBlockSelectors(element: Element): MathchesResult {
        return this.matchesAnySelector(
            element,
            this.rule.atomicBlockSelectors || []
        )
    }

    /**
     * 检查元素是否匹配 extraInlineSelectors
     * @param element 元素节点
     * @returns 是否匹配额外内联选择器
     */
    private matchesExtraInlineSelectors(element: Element): MathchesResult {
        const extraInlineSelectors = [
            ...(this.rule.extraInlineSelectors || []),
            ...(this.rule["extraInlineSelectors.add"] || [])
        ]
        return this.matchesAnySelector(element, extraInlineSelectors)
    }

    /**
     * 检查元素是否匹配 extraBlockSelectors
     * @param element 元素节点
     * @returns 是否匹配额外块级选择器
     */
    private matchesExtraBlockSelectors(element: Element): MathchesResult {
        return this.matchesAnySelector(
            element,
            this.rule.extraBlockSelectors || []
        )
    }

    /**
     * 检查 ASIDE 元素是否应该翻译
     *
     * 规则（按优先级）：
     * 1. 总字符 > asideMaxTextCount(1000) → 不翻译（内容过多，可能是广告区）
     * 2. 总字符 ≤ asideMaxTextCount(1000)：
     *    - 有长段落（≥67字符 或 ≥12词） → ✅翻译（如侧边栏文章摘要）
     *    - 无长段落 → ❌不翻译（如导航菜单）
     *
     * 注：长段落定义为满足以下任一条件：
     * - 字符数 ≥ asideMaxTextCountPerParagraph(67)
     * - 单词数 ≥ asideMaxWordCountPerParagraph(12)
     *
     * @param element ASIDE 元素
     * @returns NodeAction.REJECT(不翻译) | null(继续正常流程，即翻译)
     */
    private checkAsideElement(element: HTMLElement): NodeAction | null {
        // 提取 aside 内的所有文本
        const textContent = this.extractElementText(element)

        if (!textContent || textContent.trim().length === 0) {
            return NodeAction.REJECT // 空内容，不翻译
        }

        const totalChars = textContent.length

        // 获取配置（带默认值）
        const asideMaxTextCount = this.rule.asideMaxTextCount ?? 1000
        const asideMaxTextCountPerParagraph =
            this.rule.asideMaxTextCountPerParagraph ?? 67
        const asideMaxWordCountPerParagraph =
            this.rule.asideMaxWordCountPerParagraph ?? 12
        // 规则1: 总字符 > 上限 → 不翻译（内容过多）
        if (totalChars > asideMaxTextCount) {
            return NodeAction.REJECT
        }

        // 规则2: 总字符 ≤ 上限，检查是否有长段落
        // 长段落定义：≥67字符 OR ≥12词
        const hasLongParagraph = this.hasLongParagraphInElement(
            element,
            asideMaxTextCountPerParagraph,
            asideMaxWordCountPerParagraph
        )

        if (hasLongParagraph) {
            // 有长段落 → 翻译（如侧边栏文章摘要）
            return null // 继续正常流程
        }

        // 无长段落 → 不翻译（如导航菜单）
        return NodeAction.REJECT
    }

    /**
     * 提取元素的所有文本内容（递归）
     * @param element 元素
     * @returns 文本内容
     */
    private extractElementText(element: HTMLElement): string {
        const textList: string[] = []

        const traverse = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent?.trim()
                if (text) {
                    textList.push(text)
                }
                return
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element
                // 跳过排除的元素
                if (this.matchesExcludeSelectors(el).mathches) {
                    return
                }
                if (this.rule.excludeTags?.includes(el.tagName)) {
                    return
                }
            }

            for (const child of Array.from(node.childNodes)) {
                traverse(child)
            }
        }

        traverse(element)
        return textList.join(" ")
    }

    /**
     * 检查元素中是否有长段落
     * @param element 元素
     * @param minChars 长段落最小字符数
     * @param minWords 长段落最小单词数
     * @returns 是否有长段落
     */
    private hasLongParagraphInElement(
        element: HTMLElement,
        minChars: number,
        minWords: number
    ): boolean {
        // 获取所有直接文本节点和段落级元素
        const checkNode = (node: Node): boolean => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent?.trim() || ""
                const words = text.match(/\b\w+\b/g) || []
                // 长段落定义：≥minChars字符 OR ≥minWords单词
                if (text.length >= minChars || words.length >= minWords) {
                    return true
                }
                return false
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement
                const tagName = el.tagName.toUpperCase()

                // 跳过排除的元素
                if (this.matchesExcludeSelectors(el).mathches) {
                    return false
                }
                if (this.rule.excludeTags?.includes(tagName)) {
                    return false
                }

                // 段落级元素：检查其文本内容
                const text = el.textContent?.trim() || ""
                const words = text.match(/\b\w+\b/g) || []
                // 长段落定义：≥minChars字符 OR ≥minWords单词
                if (text.length >= minChars || words.length >= minWords) {
                    return true
                }
            }

            return false
        }

        return checkNode(element)
    }

    /**
     * 预编译正则表达式（性能优化）
     */
    private compileRegexps() {
        // 编译 excludeRegexps
        const exclude = (this.rule.excludeRegexps || []).map(
            pattern => new RegExp(pattern)
        )

        // 编译 noTranslateRegexp
        const noTranslate = (this.rule.noTranslateRegexp || []).map(
            pattern => new RegExp(pattern)
        )

        // 编译 excludeSelectorsRegexes
        const selectorRegexes = new Map<string, RegExp[]>()
        if (this.rule.excludeSelectorsRegexes) {
            for (const [selector, patterns] of Object.entries(
                this.rule.excludeSelectorsRegexes
            )) {
                selectorRegexes.set(
                    selector,
                    patterns.map(p => new RegExp(p))
                )
            }
        }

        return { exclude, noTranslate, selectorRegexes }
    }
}
