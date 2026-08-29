import { find, reduce } from "ramda"

import {
    createLoadingELement,
    createTranslationContainerElement,
    createTranslationDisplayElement,
    createTranslationErrorUI,
    getStringByteLength,
    insertAfter,
    matchUrlPatternList,
    parseErrorString,
    safeRemoveElement,
    splitTranslationResults,
    type TranslationStyleUnion
} from "@/utils"
import { isDevelopment } from "@/utils/environment"

import { type Message } from "../types"
import type { ExtensionConfig } from "../types/config"
import {
    createDefaultCache,
    type CacheKeyParams,
    type TieredTranslationCache
} from "./cache"
import { DebugManager } from "./DebugManager"
import { DomSelector } from "./DomSelector"
import { type TranslationNode } from "./DOMTraverser"
import type { MutationObserverManager } from "./MutationObserverManager"
import { PerformanceMonitor } from "./PerformanceMonitor"
import {
    abortAllTranslations,
    buildAiSummary,
    hasAITranslationEnabled,
    translateBatch as translateWithService,
    type TranslationRuntimeConfig
} from "./translationService"

/**
 * ImmersiveTranslator 构造函数配置
 */
export interface ImmersiveTranslatorConfig {
    currentModel?: string
    /** 目标语言（必传） */
    targetLanguage: string
    /** 每秒最大请求数（可选，默认3） */
    maxRequestsPerSecond?: number
    /** 单次请求最大文本长度（可选，默认1024） */
    maxTextLengthPerRequest?: number
    /** 翻译样式（可选，默认highlight） */
    translationStyle?: TranslationStyleUnion
    /** 可视区域最小节点阈值（可选，默认20） */
    minVisibleNodesThreshold?: number
    /** 是否优先翻译可视区域（可选，默认true） */
    prioritizeVisibleArea?: boolean
    /** 永不翻译的语言列表（可选） */
    neverTranslateLanguages?: string[]
    /** 总是翻译的语言列表（可选） */
    alwaysTranslateLanguages?: string[]
    /** 永不翻译的URL列表（可选） */
    neverTranslateUrls?: string[]
    /** 调试模式（可选，默认false） */
    debug?: boolean
    /** AI模型列表（必传） */
    aiModelList: ExtensionConfig["aiModelList"]
    /** AI角色（必传） */
    aiRole: ExtensionConfig["aiRole"]
    /** 是否启用思考能力（可选，默认false） */
    enableThinking?: boolean
    /** 是否启用缓存（可选，默认true） */
    cacheEnabled?: boolean
    /** 是否启用AI智能上下文翻译（可选，默认false） */
    enableContext?: boolean
}
interface DisplayElementNode {
    id: string
    container: Element
    loading?: Element
    error?: Element
    translate?: Element
    status: "loading" | "error" | "translated" | "default"
}

/**
 * 网页沉浸式翻译管理器
 * 负责智能识别页面内容、批量翻译并在原位置显示翻译结果
 * 支持增量翻译、状态管理和完整的清理机制
 */
export class ImmersiveTranslator {
    /** 翻译结果节点列表，用于在原位置插入翻译文本的DOM元素 */
    public translationNodes: DisplayElementNode[] = []

    /** 原始待翻译节点列表，页面中经过筛选后需要翻译的源DOM节点 */
    private sourceTextNodes: TranslationNode[] = []

    /** 需要保持原样的元素映射（占位符替换用） */
    private stayOriginalMap: Record<string, Element> = {}

    /** 翻译结果缓存 - 使用分层缓存系统（L1内存 + L2持久化） */
    private translationCache: TieredTranslationCache

    /** 当前使用的模型ID，用于缓存键生成 */
    private currentModel: string | number

    /** 单次翻译请求的最大字节数限制，用于批量请求优化 */
    private MAX_REQUEST_BYTES = 1024

    /** 翻译成该语言 (翻译后的语言) */
    private targetLanguage: string = "zh-CN"

    /** 识别到网页的语言（需要被翻译的语言） */
    private detectedLanguage: string = "en"

    /** 同一时间最大并行翻译请求数，避免过多并发导致服务器压力 */
    private MAX_CONCURRENT_REQUESTS = 3

    /** 当前翻译服务运行配置 */
    private translationRuntimeConfig: TranslationRuntimeConfig

    /** DOM 选择器 */
    private domSelector: DomSelector

    /** 调试管理器 */
    private debugManager: DebugManager

    /** DOM 变化监听管理器 */
    private mutationObserverManager: MutationObserverManager | null = null

    /** document.body 监听器，用于检测新增的未翻译节点 */
    private bodyObserver: MutationObserver | null = null

    /** 永不翻译的语言列表 */
    private neverTranslateLanguages: string[] = []

    /** 永不翻译的网址列表 */
    private neverTranslateUrls: string[] = []

    /** 翻译样式配置 */
    private translationStyle: TranslationStyleUnion = "highlight"

    /** 可视区域翻译相关配置 */
    private minVisibleNodesThreshold: number = 20
    private prioritizeVisibleArea: boolean = true
    private visibleNodes = new Set<TranslationNode>([])
    private nonVisibleNodes = new Set<TranslationNode>([])

    /** 翻译任务中断标志 */
    private isTranslationAborted = false

    /** DOM 插入批次大小（每批插入的节点数量） */
    private readonly DOM_INSERT_BATCH_SIZE = 20

    /** DOM 插入间隔时间（毫秒） */
    private readonly DOM_INSERT_INTERVAL = 16 // 约 60fps

    /** 待插入的渲染队列 */
    private renderQueue: Array<{ id: string; text: string }> = []

    /** 是否正在处理渲染队列 */
    private isProcessingRenderQueue = false

    /** 性能监控器（仅开发环境） */
    private performanceMonitor: PerformanceMonitor | null = null

    /** 是否启用AI智能上下文翻译 */
    private enableContext: boolean = false

    /** 页面内容摘要（用于AI上下文翻译） */
    private pageSummary: string = ""

    /**
     * 构造函数，初始化沉浸式翻译管理器
     * 自动清理之前的翻译状态，确保干净的初始环境
     * @param config 扩展配置
     */
    constructor(config: ImmersiveTranslatorConfig) {
        this.targetLanguage = config.targetLanguage
        this.currentModel = config.currentModel ?? "default"
        this.MAX_CONCURRENT_REQUESTS = config.maxRequestsPerSecond ?? 3
        this.MAX_REQUEST_BYTES = config.maxTextLengthPerRequest ?? 1024
        this.translationStyle = config.translationStyle ?? "highlight"
        this.enableContext = config.enableContext ?? false
        this.translationRuntimeConfig = {
            currentModel: config.currentModel,
            aiModelList: config.aiModelList,
            aiRole: config.aiRole,
            enableThinking: config.enableThinking
        }
        this.minVisibleNodesThreshold = config.minVisibleNodesThreshold ?? 20
        this.prioritizeVisibleArea = config.prioritizeVisibleArea ?? true
        this.neverTranslateLanguages = config.neverTranslateLanguages ?? []
        this.neverTranslateUrls = config.neverTranslateUrls ?? []
        // 初始化调试管理器
        this.debugManager = new DebugManager(config.debug)

        // 初始化 DOM 选择器（使用新架构）
        this.domSelector = new DomSelector({
            currentUrl: window.location.href,
            currentHostname: window.location.hostname,
            neverTranslateLanguages: config.neverTranslateLanguages,
            alwaysTranslateLanguages: config.alwaysTranslateLanguages,
            prioritizeVisibleArea: config.prioritizeVisibleArea,
            minVisibleNodesThreshold: config.minVisibleNodesThreshold
        })

        // 初始化分层翻译缓存系统（默认启用）
        if (config.cacheEnabled !== false) {
            this.translationCache = createDefaultCache()
            this.initializeCache()
        }

        // 异步初始化 DOM 选择器
        this.initializeDomSelector(config.debug)

        // 🕐 初始化性能监控器（仅开发环境）
        if (isDevelopment()) {
            this.performanceMonitor = new PerformanceMonitor({
                enabled: true,
                logLevel: "detailed",
                autoLog: true
            })
            console.log("🔍 [开发环境] 性能监控已启用")
        }

        // this.initialize()
        if (config.debug) {
            this.debugManager.enableDebugMode()
        }
    }

    /**
     * 初始化翻译缓存系统
     */
    private async initializeCache(): Promise<void> {
        try {
            await this.translationCache.init()
            console.log("✅ ImmersiveTranslator: 翻译缓存系统初始化成功")
        } catch (error) {
            console.error(
                "❌ ImmersiveTranslator: 翻译缓存系统初始化失败",
                error
            )
        }
    }

    /**
     * 异步初始化 DOM 选择器
     */
    private async initializeDomSelector(debug: boolean): Promise<void> {
        try {
            await this.domSelector.initialize()
            // 调试信息：显示匹配的规则
            if (debug) {
                this.domSelector.getRuleEngine()
            }
        } catch (error) {
            console.error("❌ ImmersiveTranslator: DOM选择器初始化失败", error)
        }
    }

    /**
     * 初始化沉浸式翻译管理器
     * 清理之前的所有翻译状态和DOM修改，确保环境干净
     */
    public initialize() {
        this.clearAllTranslations()
    }

    /**
     * 更新配置
     */
    public async updateConfig(config: ImmersiveTranslatorConfig) {
        this.targetLanguage = config.targetLanguage
        this.currentModel = config.currentModel ?? "default"
        this.MAX_CONCURRENT_REQUESTS = config.maxRequestsPerSecond ?? 3
        this.MAX_REQUEST_BYTES = config.maxTextLengthPerRequest ?? 1024
        this.translationStyle = config.translationStyle ?? "highlight"
        this.neverTranslateLanguages = config.neverTranslateLanguages ?? []
        this.neverTranslateUrls = config.neverTranslateUrls ?? []
        this.translationRuntimeConfig = {
            currentModel: config.currentModel,
            aiModelList: config.aiModelList,
            aiRole: config.aiRole,
            enableThinking: config.enableThinking
        }
    }

    /**
     * 检查检测到的语言是否在永不翻译列表中
     */
    private isDetectedLanguageNeverTranslate(): boolean {
        if (
            !this.neverTranslateLanguages ||
            this.neverTranslateLanguages.length === 0
        ) {
            return false
        }

        return this.neverTranslateLanguages.includes(this.detectedLanguage)
    }

    /**
     * 根据规则获取翻译的 DOM 节点
     * 使用新架构：DomSelector 内部的 RuleEngine 自动处理规则匹配
     */
    private extractTargetTextNodes() {
        // 从 DomSelector 获取提取和分类后的节点
        const {
            result: extractedNodes,
            stayOriginalMap,
            visibleNodes,
            nonVisibleNodes
        } = this.domSelector.extractTargetTextNodes()

        this.sourceTextNodes = extractedNodes
        this.stayOriginalMap = stayOriginalMap

        // 如果启用了可视区域优先，使用 DomSelector 返回的分类结果
        if (this.prioritizeVisibleArea) {
            this.visibleNodes = new Set(visibleNodes)
            this.nonVisibleNodes = new Set(nonVisibleNodes)
        }

        return this.sourceTextNodes
    }

    /**
     * 检查是否应该翻译所有节点
     * 当可视区域节点数量少于阈值时返回 true
     */
    private shouldTranslateAllNodes(): boolean {
        return this.visibleNodes.size < this.minVisibleNodesThreshold
    }

    /**
     * 创建翻译展示容器
     */
    private createTranslationContainers(nodes: TranslationNode[]): Element[] {
        const newTranslationNodes = reduce<TranslationNode, Element[]>(
            (prev, node) => {
                if (this.translationNodes.find(v => v.id === node.id)) {
                    return prev
                }
                const uniqueId = node.id
                const container = createTranslationContainerElement(
                    this.targetLanguage,
                    uniqueId,
                    node.insertTagType
                )
                this.translationNodes.push({
                    id: uniqueId,
                    container,
                    status: "default"
                })
                const sourceNode = this.sourceTextNodes.find(
                    v => v.id === node.id
                )
                if (sourceNode) {
                    const lastTextNode = sourceNode.textNodes.at(-1)
                    if (lastTextNode) {
                        insertAfter(container, lastTextNode.element)
                    }
                }

                prev.push(container)
                return prev
            },
            [],
            nodes
        )

        return newTranslationNodes
    }

    /**
     * 执行完整的沉浸式翻译流程
     * 包括内容提取、智能分批、异步翻译和结果展示
     * @returns Promise<boolean> 翻译是否成功执行
     */
    public async startImmersiveTranslation(): Promise<boolean> {
        // 🕐 开始性能监控
        this.performanceMonitor?.start(
            "ImmersiveTranslator.startImmersiveTranslation"
        )

        try {
            // 第一步：清空所有翻译状态和DOM修改
            this.performanceMonitor?.startStage("清空翻译状态")
            this.clearAllTranslations()
            this.performanceMonitor?.endStage()

            // 🟢 重置中断标志，允许新的翻译任务执行
            this.isTranslationAborted = false

            // 检查当前网站是否在永不翻译列表中
            this.performanceMonitor?.startStage("URL检查")
            if (
                matchUrlPatternList(
                    this.neverTranslateUrls,
                    window.location.href
                )
            ) {
                this.performanceMonitor?.endStage({ result: "rejected" })
                this.performanceMonitor?.end({
                    success: false,
                    reason: "URL在永不翻译列表"
                })
                return false
            }
            this.performanceMonitor?.endStage({ result: "passed" })

            // 检查检测到的语言是否在永不翻译列表中
            this.performanceMonitor?.startStage("语言检查")
            if (this.isDetectedLanguageNeverTranslate()) {
                this.performanceMonitor?.endStage({ result: "rejected" })
                this.performanceMonitor?.end({
                    success: false,
                    reason: "语言在永不翻译列表"
                })
                return false
            }
            this.performanceMonitor?.endStage({ result: "passed" })

            // 第三步：提取并筛选需要翻译的文本节点
            this.performanceMonitor?.startStage("提取文本节点")
            this.extractTargetTextNodes()
            this.performanceMonitor?.endStage({
                nodeCount: this.sourceTextNodes.length
            })

            // 如果没有找到需要翻译的内容，直接返回
            if (this.sourceTextNodes.length === 0) {
                this.performanceMonitor?.end({
                    success: false,
                    reason: "未找到需要翻译的内容"
                })
                return false
            }

            // 第四步：创建并插入翻译容器节点
            this.performanceMonitor?.startStage("创建翻译容器")
            this.createTranslationContainers(this.sourceTextNodes)
            this.performanceMonitor?.endStage({
                containerCount: this.translationNodes.length
            })

            // 第五步：根据可视区域优先策略确定翻译节点
            this.performanceMonitor?.startStage("可视性分类")
            let nodesToTranslate: TranslationNode[]
            if (this.prioritizeVisibleArea && !this.shouldTranslateAllNodes()) {
                nodesToTranslate = [
                    ...this.visibleNodes,
                    ...this.nonVisibleNodes
                ]
                this.performanceMonitor?.endStage({
                    visibleCount: this.visibleNodes.size,
                    nonVisibleCount: this.nonVisibleNodes.size
                })
            } else {
                nodesToTranslate = this.sourceTextNodes
                this.performanceMonitor?.endStage({ strategy: "all" })
            }

            // 第六步：使用抽象的翻译执行方法
            this.performanceMonitor?.startStage("执行翻译")
            await this.executeTranslation(nodesToTranslate, {
                checkCache: true,
                useConcurrentGroups: true
            })
            this.performanceMonitor?.endStage()

            // 🕐 结束性能监控
            this.performanceMonitor?.end({
                success: true,
                totalNodes: this.sourceTextNodes.length,
                translatedNodes: nodesToTranslate.length
            })

            return true
        } catch (error) {
            this.performanceMonitor?.end({
                success: false,
                error: error.message
            })

            if (error.message?.includes("stopped")) {
                return false
            }
            throw error
        } finally {
            // 🔴 只有在未中断的情况下才启动监听器
            if (!this.isTranslationAborted) {
                // 清理所有loading节点
                this.clearAllLoadingNodes()
                // 启动 DOM 变化监听器
                // 启动 body 监听器，检测新增节点
                this.startBodyObserver()
            } else {
                // 如果已中断，只清理loading节点，不启动监听器
                this.clearAllLoadingNodes()
            }
        }
    }

    /**
     * 智能分批翻译请求，优化网络性能
     * 根据内容字节数合理分组，避免单次请求过大导致的性能问题
     * @param messages 待翻译的消息列表
     * @returns 分批后的消息组列表
     */
    private optimizeBatchRequests(messages: Message[]) {
        const { list: batchedMessages } = reduce<
            Message,
            {
                list: Message[][]
                countByte: number
            }
        >(
            (
                { list: previousBatches, countByte: previousBytes },
                currentMessage
            ) => {
                const messageBytes = getStringByteLength(currentMessage.content)
                const totalBytes = previousBytes + messageBytes

                // 如果超过单次请求限制，开启新批次
                if (totalBytes > this.MAX_REQUEST_BYTES) {
                    previousBatches.push([currentMessage])
                    return { list: previousBatches, countByte: messageBytes }
                }

                // 否则添加到当前批次
                const currentBatch = previousBatches.at(-1)
                if (currentBatch) {
                    currentBatch.push(currentMessage)
                } else {
                    previousBatches.push([currentMessage])
                }

                return { list: previousBatches, countByte: totalBytes }
            },
            {
                list: [],
                countByte: 0
            },
            messages
        )
        return { batchedMessages }
    }

    /**
     * 控制并发翻译请求，避免同时发起过多请求
     * 将批次分组，每组最多包含MAX_CONCURRENT_REQUESTS个批次
     * @param batches 所有待处理的翻译批次
     * @returns 按并发限制分组的批次组列表
     */
    private controlConcurrentRequests(batches: Message[][]): Message[][][] {
        const concurrentGroups: Message[][][] = []

        for (let i = 0; i < batches.length; i += this.MAX_CONCURRENT_REQUESTS) {
            const group = batches.slice(i, i + this.MAX_CONCURRENT_REQUESTS)
            concurrentGroups.push(group)
        }

        return concurrentGroups
    }

    private showLoadingByIds(ids: string[]) {
        for (const node of this.translationNodes) {
            if (ids.includes(node.id)) {
                const { spinner } = createLoadingELement(8)
                node.container.appendChild(spinner)
                node.loading = spinner
                node.status = "loading"
            }
        }
    }

    /**
     * 清理所有loading节点
     * 统一管理loading节点的销毁，防止内存泄漏
     */
    private clearAllLoadingNodes() {
        this.clearLoadingForNodeIds(this.translationNodes.map(node => node.id))
    }

    /**
     * 清理指定批次的加载动画
     * @param messageBatch 需要清理loading的消息批次
     */
    private clearLoadingForNodeIds(ids: string[]) {
        ids.forEach(nodeId => {
            const translateNode = this.translationNodes.find(
                node => node.id === nodeId
            )
            if (translateNode) {
                const loadingElement = translateNode.loading
                if (loadingElement) {
                    // 从DOM中移除
                    safeRemoveElement(loadingElement)
                }
            }
        })
    }

    /**
     * 缓存翻译结果并清理对应的加载动画
     * @param translationResults 翻译服务返回的结果对象
     */
    private async cacheTranslationResults(
        translationResults: { id: string; text: string }[]
    ): Promise<void> {
        // 如果缓存未启用，直接返回
        if (!this.translationCache) {
            // 仍然需要更新源节点的翻译文本
            translationResults.forEach(({ id, text }) => {
                const sourceNode = find(v => v.id === id, this.sourceTextNodes)
                if (sourceNode) {
                    sourceNode.translateText = text
                }
            })
            return
        }

        // 批量缓存翻译结果到分层缓存系统
        const cacheEntries = translationResults
            .map(({ id, text }) => {
                const sourceNode = find(v => v.id === id, this.sourceTextNodes)
                if (!sourceNode) {
                    return null
                }

                // 更新源节点的翻译文本
                sourceNode.translateText = text

                // 构建缓存键参数
                const cacheParams: CacheKeyParams = {
                    text: sourceNode.originText,
                    sourceLang: this.detectedLanguage,
                    targetLang: this.targetLanguage,
                    modelId: this.currentModel,
                    aiRole: "translator"
                }

                return {
                    params: cacheParams,
                    translation: text,
                    ttl: 7 * 24 * 60 * 60 * 1000 // 7天过期
                }
            })
            .filter(Boolean)

        // 批量设置缓存（异步，不阻塞）
        if (cacheEntries.length > 0) {
            this.translationCache
                .batchSet(cacheEntries)
                .catch(error => console.error("缓存翻译结果失败:", error))
        }
    }

    /**
     * 替换翻译文本中的占位符为原始元素
     * @param translateText 翻译后的文本
     * @returns 处理后的 HTML 字符串
     */
    private replaceStayOriginalPlaceholders(translateText: string): string {
        // 如果没有需要保持原样的元素，直接返回
        if (Object.keys(this.stayOriginalMap).length === 0) {
            return translateText
        }

        // 创建临时容器来处理 HTML
        const tempContainer = document.createElement("div")
        tempContainer.innerHTML = translateText

        // 遍历 stayOriginalMap，替换占位符
        Object.entries(this.stayOriginalMap).forEach(([key, element]) => {
            // 检查 key 是否是占位符 ID（格式：@数字#）
            if (key.startsWith("@") && key.endsWith("#")) {
                // 处理 stayOriginal 类型的占位符（直接替换）
                const walker = document.createTreeWalker(
                    tempContainer,
                    NodeFilter.SHOW_TEXT,
                    null
                )

                const nodesToReplace: {
                    node: Text
                    parts: string[]
                }[] = []
                let currentNode: Text | null

                while ((currentNode = walker.nextNode() as Text)) {
                    const text = currentNode.textContent || ""
                    if (text.includes(key)) {
                        // 分割文本，保留占位符位置
                        const parts = text.split(key)
                        nodesToReplace.push({
                            node: currentNode,
                            parts
                        })
                    }
                }

                // 替换找到的占位符
                nodesToReplace.forEach(({ node, parts }) => {
                    const parent = node.parentNode
                    if (!parent) {
                        return
                    }

                    // 克隆原始元素
                    const clonedElement = element.cloneNode(true) as Element

                    // 在占位符位置插入元素
                    const fragment = document.createDocumentFragment()
                    parts.forEach((part, index) => {
                        if (part) {
                            fragment.appendChild(document.createTextNode(part))
                        }
                        // 在最后一个部分之前插入克隆的元素
                        if (index < parts.length - 1) {
                            fragment.appendChild(clonedElement.cloneNode(true))
                        }
                    })

                    parent.replaceChild(fragment, node)
                })
            } else {
                // 处理 preserveTagsInTranslation 类型的占位符（格式：标签名+数字，如 a1）
                // 查找翻译文本中的占位符标签（如 <a1>translated text</a1>）
                const placeholderElements = tempContainer.querySelectorAll(key)

                placeholderElements.forEach(placeholderElement => {
                    // 获取翻译后的文本内容
                    const translatedText = placeholderElement.textContent || ""

                    // 克隆原始元素
                    const clonedElement = element.cloneNode(
                        false
                    ) as HTMLElement

                    // 更新克隆元素的文本内容为翻译后的文本
                    clonedElement.textContent = translatedText

                    // 替换占位符元素为更新后的原始元素
                    placeholderElement.parentNode?.replaceChild(
                        clonedElement,
                        placeholderElement
                    )
                })
            }
        })

        return tempContainer.innerHTML
    }

    /**
     * 将缓存的翻译结果渲染到页面中（优化版：分批插入）
     * 根据原节点类型选择合适的插入策略（追加或插入兄弟节点）
     * 处理链接类型的文本，将其替换为 a 标签
     * 处理 stayOriginalMap 中的占位符，替换为原始元素
     *
     * 性能优化：
     * - 当结果数量较少（≤20）时，直接同步渲染
     * - 当结果数量较多（>20）时，使用分批渲染避免卡顿
     */
    private renderTranslationResults(list: { id: string; text: string }[]) {
        // 如果数量较少，直接同步渲染
        if (list.length <= this.DOM_INSERT_BATCH_SIZE) {
            this.renderBatch(list)
            return
        }

        // 数量较多时，添加到渲染队列，使用分批渲染
        this.renderQueue.push(...list)
        this.processRenderQueue()
    }

    /**
     * 处理渲染队列（分批插入 DOM）
     * 使用 requestIdleCallback 或 setTimeout 在浏览器空闲时插入
     * 避免一次性插入大量 DOM 节点导致页面卡顿
     */
    private processRenderQueue() {
        // 如果已经在处理中，直接返回
        if (this.isProcessingRenderQueue) {
            return
        }

        // 如果队列为空，直接返回
        if (this.renderQueue.length === 0) {
            return
        }

        this.isProcessingRenderQueue = true

        const processBatch = () => {
            // 检查是否已中断
            if (this.isTranslationAborted) {
                this.renderQueue = []
                this.isProcessingRenderQueue = false
                return
            }

            // 从队列中取出一批
            const batch = this.renderQueue.splice(0, this.DOM_INSERT_BATCH_SIZE)

            // 渲染这一批
            this.renderBatch(batch)

            // 如果还有剩余，继续处理
            if (this.renderQueue.length > 0) {
                // 使用 requestIdleCallback（如果支持）或 setTimeout
                if (typeof requestIdleCallback !== "undefined") {
                    requestIdleCallback(
                        () => {
                            processBatch()
                        },
                        { timeout: 1000 }
                    )
                } else {
                    setTimeout(processBatch, this.DOM_INSERT_INTERVAL)
                }
            } else {
                // 队列处理完成
                this.isProcessingRenderQueue = false
            }
        }

        // 开始处理第一批
        processBatch()
    }

    /**
     * 渲染一批翻译结果（实际的 DOM 操作）
     * @param batch 一批翻译结果
     */
    private renderBatch(batch: { id: string; text: string }[]) {
        batch.forEach(({ id: nodeId, text: translateText }) => {
            // 验证翻译文本是否有效
            if (!translateText || typeof translateText !== "string") {
                console.warn(
                    `[ImmersiveTranslator] 跳过无效的翻译文本: nodeId=${nodeId}, text=${translateText}`
                )
                return
            }

            const sourceNode = this.sourceTextNodes.find(v => v.id === nodeId)
            if (!sourceNode) {
                return
            }
            const translateNode = this.translationNodes.find(
                node => node.id === nodeId
            )
            // 清除对应的加载动画 - 使用loadingNodeList管理
            if (translateNode) {
                this.clearLoadingForNodeIds([nodeId])
            }

            // 如果翻译结果与原文相同（忽略大小写），跳过渲染
            if (
                translateText.toLocaleLowerCase() ===
                sourceNode.originText?.toLocaleLowerCase()
            ) {
                return
            }

            // 处理包含链接的翻译文本
            const processedText =
                this.replaceStayOriginalPlaceholders(translateText)

            // 再次验证处理后的文本
            if (!processedText || processedText.trim() === "") {
                return
            }

            const fontElement = translateNode.translate
            if (fontElement) {
                // 如果是 HTML 内容，使用 innerHTML
                fontElement.innerHTML = processedText
            } else {
                const translateELement = createTranslationDisplayElement(
                    processedText,
                    this.translationStyle
                )
                translateNode.translate = translateELement
                translateNode.status = "translated"
                translateNode.container.appendChild(translateELement)
            }
        })
    }

    /**
     * 完全清理所有翻译状态和DOM修改
     * 移除所有翻译展示节点、清理节点属性、重置内部状态
     * 确保页面恢复到翻译前的原始状态
     */
    public clearAllTranslations() {
        // 🔴 设置中断标志，停止所有正在执行的翻译任务
        this.isTranslationAborted = true

        // 🔴 清空渲染队列，停止分批渲染
        this.renderQueue = []
        this.isProcessingRenderQueue = false

        // 🔴 中断所有正在进行的翻译请求
        void abortAllTranslations()

        // 停止 body 监听器
        this.stopBodyObserver()

        // 清理所有loading节点
        this.clearAllLoadingNodes()

        // 移除所有翻译展示节点
        this.translationNodes.forEach(displayNode => {
            safeRemoveElement(displayNode.container)
            safeRemoveElement(displayNode.loading)
            safeRemoveElement(displayNode.error)
            safeRemoveElement(displayNode.translate)
        })

        this.translationNodes = []
        this.sourceTextNodes = []

        // 卸载 DOM 变化监听器
        this.destroyMutationObserver()
    }

    /**
     * 销毁翻译器实例
     * 清理所有资源，包括缓存系统
     */
    public destroy(): void {
        // 清理所有翻译状态
        this.clearAllTranslations()

        // 销毁缓存系统（如果已启用）
        if (this.translationCache) {
            this.translationCache.destroy()
        }
    }

    /**
     * 获取缓存统计信息
     * 用于监控缓存性能
     */
    public async getCacheStats() {
        if (!this.translationCache) {
            console.warn("缓存未启用")
            return null
        }

        try {
            return await this.translationCache.getStats()
        } catch (error) {
            console.error("获取缓存统计信息失败:", error)
            return null
        }
    }

    /**
     * 清理过期缓存
     * 可以手动调用以释放存储空间
     */
    public async cleanExpiredCache(): Promise<void> {
        if (!this.translationCache) {
            console.warn("缓存未启用，无需清理")
            return
        }

        try {
            await this.translationCache.clear()
            console.log("✅ 已清理过期缓存")
        } catch (error) {
            console.error("清理缓存失败:", error)
        }
    }

    /**
     * 设置最小可视节点阈值
     * @param threshold 阈值数量
     */
    public setMinVisibleNodesThreshold(threshold: number): void {
        this.minVisibleNodesThreshold = threshold
    }

    /**
     * 判断当前是否使用 AI 翻译模型
     * @returns 是否使用 AI 模型
     */
    private isUsingAiModel(): boolean {
        return hasAITranslationEnabled(this.translationRuntimeConfig)
    }

    /**
     * 提取页面内容（标题和正文）
     * @returns 页面标题和正文内容
     */
    private async extractPageContent(): Promise<{
        title: string
        textContent: string
    }> {
        // 总是提取标题
        const title = document.title || ""

        // 只在启用上下文时提取正文
        let textContent = ""
        if (this.enableContext) {
            try {
                // 方案 A: 使用 Readability 提取主要内容（推荐）
                const { Readability } = await import("@mozilla/readability")
                const documentClone = document.cloneNode(true) as Document
                const reader = new Readability(documentClone)
                const article = reader.parse()
                textContent = article?.textContent || ""
            } catch (error) {
                console.warn(
                    "[ImmersiveTranslator] Readability 提取失败，降级到 body.textContent:",
                    error
                )
                // 方案 B: 降级到 body.textContent
                textContent = document.body?.textContent || ""
            }
        }

        return { title, textContent }
    }

    /**
     * 生成页面内容摘要
     * @param title 页面标题
     * @param textContent 页面正文
     */
    private async generatePageSummary(
        title: string,
        textContent: string
    ): Promise<void> {
        // 如果未启用上下文或内容为空，直接返回
        if (!this.enableContext || !textContent.trim()) {
            this.pageSummary = ""
            return
        }

        try {
            const summary = await buildAiSummary(
                this.translationRuntimeConfig,
                title,
                textContent
            )
            this.pageSummary = summary
        } catch (err) {
            console.error("[ImmersiveTranslator] 生成页面摘要失败:", err)
            this.pageSummary = ""
        }
    }

    /**
     * 执行批量翻译的核心逻辑
     * 抽象了翻译流程中的共同步骤：构建消息、分批、显示loading、执行翻译、处理结果
     * @param nodes 需要翻译的节点列表
     * @param options 翻译选项
     * @returns 翻译是否成功
     */
    private async executeTranslation(
        nodes: TranslationNode[],
        options: {
            checkCache?: boolean
            useConcurrentGroups?: boolean
            onBatchComplete?: (batch: Message[]) => void
        } = {}
    ): Promise<boolean> {
        const { checkCache = true, useConcurrentGroups = false } = options

        // 🔴 检查是否已中断
        if (this.isTranslationAborted) {
            return false
        }

        // 构建翻译消息（检查缓存、过滤空文本）
        const translationMessages: Message[] = []

        // 🕐 开始缓存查询阶段
        this.performanceMonitor?.startStage("缓存查询")

        let cacheHitCount = 0

        // ⚡ 优化：使用 Promise.all() 并行查询缓存
        if (checkCache && this.translationCache) {
            // 构建所有缓存查询的 Promise
            const cacheQueries = nodes.map(async node => {
                try {
                    // 构建缓存键参数
                    const cacheParams: CacheKeyParams = {
                        text: node.originText,
                        sourceLang: this.detectedLanguage,
                        targetLang: this.targetLanguage,
                        modelId: this.currentModel,
                        aiRole: "translator"
                    }

                    // 从分层缓存系统获取
                    const cachedResult =
                        await this.translationCache.get(cacheParams)

                    return {
                        node,
                        cachedResult,
                        error: null
                    }
                } catch (error) {
                    console.error("获取缓存失败:", error)
                    return {
                        node,
                        cachedResult: null,
                        error
                    }
                }
            })

            // 并行执行所有缓存查询
            const cacheResults = await Promise.all(cacheQueries)

            // 处理缓存结果
            this.performanceMonitor?.startStage("处理缓存结果")
            const cachedRenderList: Array<{ id: string; text: string }> = []

            for (const { node, cachedResult } of cacheResults) {
                if (cachedResult) {
                    cacheHitCount++
                    // 收集需要渲染的缓存结果
                    cachedRenderList.push({ id: node.id, text: cachedResult })
                } else {
                    // 缓存未命中，添加到翻译队列
                    translationMessages.push({
                        role: "user",
                        content: node.originText,
                        id: node.id
                    })
                }
            }

            // 批量渲染缓存结果
            if (cachedRenderList.length > 0) {
                this.renderTranslationResults(cachedRenderList)
            }

            this.performanceMonitor?.endStage()
        } else {
            // 不检查缓存，直接构建翻译消息
            for (const node of nodes) {
                translationMessages.push({
                    role: "user",
                    content: node.originText,
                    id: node.id
                })
            }
        }

        this.performanceMonitor?.endStage({
            totalQueries: nodes.length,
            cacheHits: cacheHitCount,
            cacheMisses: nodes.length - cacheHitCount,
            hitRate: `${((cacheHitCount / nodes.length) * 100).toFixed(1)}%`
        })

        if (translationMessages.length === 0) {
            return false
        }

        // 🔴 再次检查是否已中断
        if (this.isTranslationAborted) {
            return false
        }

        this.showLoadingByIds(translationMessages.map(message => message.id))

        // 提取页面内容并生成摘要（如果启用上下文且使用 AI 模型）
        if (this.enableContext && this.isUsingAiModel()) {
            this.performanceMonitor?.startStage("提取页面内容")
            const { title, textContent } = await this.extractPageContent()

            this.performanceMonitor?.endStage({
                titleLength: title.length,
                contentLength: textContent.length
            })

            this.performanceMonitor?.startStage("生成页面摘要")
            await this.generatePageSummary(title, textContent)
            this.performanceMonitor?.endStage({
                summaryLength: this.pageSummary.length
            })
        }

        // 🕐 开始翻译请求阶段
        this.performanceMonitor?.startStage("翻译请求")

        // 智能分批
        this.performanceMonitor?.startStage("智能分批")
        const { batchedMessages } =
            this.optimizeBatchRequests(translationMessages)
        this.performanceMonitor?.endStage({
            batchCount: batchedMessages.length
        })

        // 执行翻译
        this.performanceMonitor?.startStage("批量翻译")

        // 📊 统计变量
        let totalRenderTime = 0
        let totalRenderCount = 0
        let totalApiTime = 0
        let totalApiCalls = 0

        const translateBatch = async (messageBatch: Message[]) => {
            // 🔴 在每个批次执行前检查中断标志
            if (this.isTranslationAborted) {
                // 清理当前批次的 loading 状态
                this.clearLoadingForNodeIds(messageBatch.map(v => v.id))
                return
            }

            try {
                const requestMessageContent = messageBatch
                    .map(v => v.content)
                    .join("\n\n%%\n\n")

                // 📊 记录接口调用开始时间
                const apiStartTime = performance.now()
                const translationResults = await translateWithService(
                    this.translationRuntimeConfig,
                    [{ role: "user", content: requestMessageContent }],
                    this.targetLanguage,
                    { pageTitle: document.title }
                )
                const apiEndTime = performance.now()

                // 累计接口响应时间
                totalApiTime += apiEndTime - apiStartTime
                totalApiCalls++

                // 🔴 翻译完成后再次检查中断标志
                if (this.isTranslationAborted) {
                    this.clearLoadingForNodeIds(messageBatch.map(v => v.id))
                    return
                }

                const translateStringList = splitTranslationResults(
                    translationResults,
                    messageBatch.length
                )

                const translateList = messageBatch.map((message, i) => ({
                    id: message.id,
                    text: translateStringList[i]
                }))

                // 缓存翻译结果
                await this.cacheTranslationResults(translateList)

                // 📊 记录渲染开始时间
                const renderStartTime = performance.now()
                this.renderTranslationResults(translateList)
                const renderEndTime = performance.now()

                // 累计渲染时间
                totalRenderTime += renderEndTime - renderStartTime
                totalRenderCount += translateList.length

                options.onBatchComplete?.(messageBatch)
            } catch (error) {
                // 🔴 如果是中断导致的错误，不显示错误提示
                if (this.isTranslationAborted) {
                    this.clearLoadingForNodeIds(messageBatch.map(v => v.id))
                    return
                }

                this.clearLoadingForNodeIds(messageBatch.map(v => v.id))
                this.addErrorForBatch(error.message, messageBatch)
            }
        }

        if (useConcurrentGroups) {
            // 使用并发组执行（用于初始翻译）
            const concurrentGroups =
                this.controlConcurrentRequests(batchedMessages)
            for (const group of concurrentGroups) {
                // 🔴 在每个并发组执行前检查中断标志
                if (this.isTranslationAborted) {
                    break
                }

                const groupPromises = group.map(translateBatch)
                await Promise.allSettled(groupPromises)
            }
        } else {
            // 顺序执行（用于重新翻译）
            for (const messageBatch of batchedMessages) {
                // 🔴 在每个批次执行前检查中断标志
                if (this.isTranslationAborted) {
                    break
                }

                await translateBatch(messageBatch)
            }
        }
        this.performanceMonitor?.endStage({
            totalApiTime: `${totalApiTime.toFixed(2)}ms`,
            totalApiCalls,
            avgApiTime:
                totalApiCalls > 0
                    ? `${(totalApiTime / totalApiCalls).toFixed(2)}ms`
                    : "0ms",
            totalRenderTime: `${totalRenderTime.toFixed(2)}ms`,
            totalRenderCount,
            avgRenderTime:
                totalRenderCount > 0
                    ? `${(totalRenderTime / totalRenderCount).toFixed(2)}ms`
                    : "0ms"
        })

        this.performanceMonitor?.endStage() // 结束翻译请求阶段

        return true
    }

    /**
     * 为指定批次的消息添加错误提示
     * @param errStr - 错误信息字符串
     * @param messageBatch - 失败的消息批次
     */
    public addErrorForBatch(errStr: string, messageBatch: Message[]): void {
        messageBatch.forEach(message => {
            const nodeId = message.id
            const displayNode = this.translationNodes.find(v => v.id === nodeId)
            if (displayNode) {
                const { errorType, errorDetails } = parseErrorString(errStr)
                const { errorContainer } = createTranslationErrorUI(
                    errorType,
                    errorDetails,
                    this.retranslateNodeIds.bind(this, [nodeId])
                )
                displayNode.error = errorContainer
                displayNode.status = "error"
                displayNode.container.appendChild(errorContainer)
            }
        })
    }

    /**
     * 重新翻译指定的节点列表
     * 用于 DOM 变化监听和错误重试
     * @param nodesToRetranslate 需要重新翻译的节点列表
     */
    private async retranslateNodeIds(nodeIds: string[]): Promise<void> {
        if (nodeIds.length === 0) {
            return
        }

        // 暂停 MutationObserver，防止翻译操作触发循环
        if (this.mutationObserverManager) {
            this.mutationObserverManager.pause()
        }

        try {
            // 在执行翻译前，移除当前翻译文本容器内的 error 元素
            nodeIds.forEach(nodeId => {
                const displayNode = this.translationNodes.find(
                    node => node.id === nodeId
                )
                if (displayNode?.error) {
                    safeRemoveElement(displayNode.error)
                    displayNode.error = undefined
                    displayNode.status = "default"
                }
            })

            const nodes = this.sourceTextNodes.filter(node =>
                nodeIds.includes(node.id)
            )
            // 使用抽象的翻译执行方法
            await this.executeTranslation(nodes, {
                checkCache: false, // 已经在上面检查过了
                useConcurrentGroups: false // 重新翻译使用顺序执行
            })
        } finally {
            // 清理所有 loading
            this.clearLoadingForNodeIds(nodeIds)

            // 恢复 MutationObserver
            if (this.mutationObserverManager) {
                this.mutationObserverManager.resume()
            }
        }
    }

    /**
     * 启动 document.body 监听器
     * 监听页面 DOM 变化，自动检测并翻译新增的节点
     */
    private startBodyObserver(): void {
        // 如果已经有监听器在运行，先停止
        this.stopBodyObserver()

        // 创建 MutationObserver
        this.bodyObserver = new MutationObserver(async mutations => {
            // 🔴 首先检查是否已中断
            if (this.isTranslationAborted) {
                return
            }

            const hasRelevantChanges = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        return false
                    }
                    const element = node as HTMLElement

                    // 忽略翻译容器和其子元素
                    if (element.hasAttribute("data-translate-id")) {
                        return false
                    }
                    if (element.closest("[data-translate-id]")) {
                        return false
                    }

                    return true
                })
            })

            if (!hasRelevantChanges) {
                return
            }
            // 检查是否有新增节点
            const hasAddedNodes = mutations.some(
                mutation => mutation.addedNodes.length > 0
            )

            if (!hasAddedNodes) {
                return
            }

            // 🔴 再次检查是否已中断（在异步操作前）
            if (this.isTranslationAborted) {
                return
            }

            // 提取所有待翻译节点
            const { result: allNodes, stayOriginalMap } =
                this.domSelector.extractTargetTextNodes()

            // 更新全局 stayOriginalMap
            this.stayOriginalMap = stayOriginalMap

            // 找出新增的节点（ID 不在现有列表中）
            const existingNodeIds = new Set(
                this.sourceTextNodes.map(node => node.id)
            )
            const newNodes = allNodes.filter(
                node => !existingNodeIds.has(node.id)
            )

            if (newNodes.length === 0) {
                return
            }

            // 添加到源节点列表
            this.sourceTextNodes.push(...newNodes)

            // 创建翻译容器
            this.createTranslationContainers(newNodes)

            // 🔴 执行翻译前最后一次检查
            if (this.isTranslationAborted) {
                return
            }

            // 执行翻译
            try {
                await this.executeTranslation(newNodes, {
                    checkCache: true,
                    useConcurrentGroups: false // 新增节点使用顺序执行
                })
            } catch (error) {
                console.error(
                    "[ImmersiveTranslator] 翻译新增节点时出错:",
                    error
                )
            }
        })

        // 开始监听 document.body
        if (document.body) {
            this.bodyObserver.observe(document.body, {
                childList: true, // 监听子节点的添加和删除
                subtree: true // 监听所有后代节点
            })
        } else {
            console.warn(
                "[ImmersiveTranslator] document.body 不存在，无法启动监听"
            )
        }
    }

    /**
     * 停止 document.body 监听器
     */
    private stopBodyObserver(): void {
        if (this.bodyObserver) {
            this.bodyObserver.disconnect()
            this.bodyObserver = null
        }
    }

    /**
     * 销毁 DOM 变化监听器
     * 在关闭翻译或清理时调用
     */
    private destroyMutationObserver(): void {
        if (this.mutationObserverManager) {
            this.mutationObserverManager.destroy()
            this.mutationObserverManager = null
        }
    }
}
