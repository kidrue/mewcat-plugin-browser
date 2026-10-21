import type { TranslationRule } from "@/types"

import type { TranslationNode } from "./DOMTraverser"

/**
 * MutationObserver 专用配置接口
 * 只包含 DOM 监听相关的必要配置
 */
export interface MutationObserverConfig {
    /** 额外监听的全局容器选择器列表 */
    containerSelectors?: string[]
    /** 变化延迟触发时间（毫秒，默认 10） */
    changeDelay?: number
}

/**
 * 从 TranslationRule 中提取 MutationObserver 配置
 * @param rule 翻译规则
 * @returns MutationObserver 配置
 */
export function extractMutationConfig(
    rule: TranslationRule
): MutationObserverConfig {
    return {
        containerSelectors: rule.mutationObserverContainerSelectors,
        changeDelay: rule.mutationChangeDelay
    }
}

/**
 * MutationObserver 回调函数类型
 * 当监听到 DOM 变化时调用此回调进行重新翻译
 * @param changedContainers 发生变化的容器元素列表
 * @param addedNodes 新增的节点列表（用于SPA新增内容）
 */
export type MutationCallback = (
    changedContainers: HTMLElement[]
) => void | Promise<void>

/**
 * MutationObserverManager 配置接口
 */
export interface MutationObserverManagerConfig {
    /** MutationObserver 配置 */
    config: MutationObserverConfig
    /** 源文本节点列表（用于监听每个节点的容器） */
    sourceTextNodes: TranslationNode[]
    /** DOM 变化回调函数（触发重新翻译） */
    onMutation: MutationCallback
    /** 是否启用调试模式 */
    debug?: boolean
}

/**
 * DOM 动态变化监听管理器
 *
 * 功能：
 * 1. 默认为每个 sourceTextNode 的容器创建监听器
 * 2. 额外根据 config.containerSelectors 创建全局监听器
 * 3. 使用防抖机制避免频繁触发翻译
 * 4. 变化时只触发相关容器的重新翻译，而非全局翻译
 * 5. 提供统一的启动和卸载接口
 *
 * 使用场景：
 * - 单页应用（SPA）的动态内容加载
 * - 无限滚动列表
 * - 实时聊天消息
 * - 动态加载的文章内容
 */
export class MutationObserverManager {
    /** MutationObserver 配置 */
    private config: MutationObserverConfig

    /** 源文本节点列表 */
    private sourceTextNodes: TranslationNode[]

    /** DOM 变化回调函数 */
    private onMutation: MutationCallback

    /** 是否启用调试模式 */
    private debug: boolean

    /** MutationObserver 实例映射表（容器 -> Observer） */
    private observerMap: Map<HTMLElement, MutationObserver> = new Map()

    /** 已监听的容器集合（用于去重和动态添加） */
    private observedContainers: Set<HTMLElement> = new Set()

    /** 防抖定时器 */
    private debounceTimer: number | null = null

    /** 是否正在处理变化 */
    private isProcessing = false

    /** 待处理的变化容器集合 */
    private pendingContainers: Set<HTMLElement> = new Set()

    /** 待处理的新增节点集合 */
    private pendingAddedNodes: Set<Node> = new Set()

    /** 是否暂停监听（用于防止翻译时触发循环） */
    private isPaused = false

    constructor(managerConfig: MutationObserverManagerConfig) {
        this.config = managerConfig.config
        this.sourceTextNodes = managerConfig.sourceTextNodes
        this.onMutation = managerConfig.onMutation
        this.debug = managerConfig.debug ?? false
    }

    /**
     * 启动监听器
     * 1. 为每个 sourceTextNode 的容器创建监听器（过滤翻译失败的节点）
     * 2. 额外为 config.containerSelectors 创建全局监听器
     */
    public start(): void {
        if (this.debug) {
            console.log("[MutationObserverManager] 启动 DOM 变化监听...")
        }

        // 1. 为每个 sourceTextNode 的容器创建监听器
        // 过滤掉翻译失败的节点（没有翻译成功的节点）
        const successfulNodes = this.filterSuccessfulNodes(this.sourceTextNodes)
        const containerSet = new Set<HTMLElement>()

        successfulNodes.forEach(node => {
            const container = node.container
            if (container && !containerSet.has(container)) {
                containerSet.add(container)
                this.observeContainer(container, "sourceNode")
            }
        })

        if (this.debug) {
            console.log(
                `[MutationObserverManager] 已为 ${containerSet.size} 个成功翻译的源节点容器创建监听器` +
                    ` (过滤了 ${this.sourceTextNodes.length - successfulNodes.length} 个失败节点)`
            )
        }

        // 2. 额外监听配置的全局容器
        const globalContainerSelectors = this.config.containerSelectors || []

        if (globalContainerSelectors.length > 0) {
            globalContainerSelectors.forEach(selector => {
                const containers = document.querySelectorAll(selector)
                containers.forEach(container => {
                    if (
                        container instanceof HTMLElement &&
                        !containerSet.has(container)
                    ) {
                        containerSet.add(container)
                        this.observeContainer(container, "globalContainer")
                    }
                })
            })

            if (this.debug) {
                console.log(
                    `[MutationObserverManager] 额外监听了 ${globalContainerSelectors.length} 个全局容器选择器`
                )
            }
        }

        if (this.debug) {
            console.log(
                `[MutationObserverManager] 总共创建 ${this.observerMap.size} 个监听器`
            )
        }
    }

    /**
     * 过滤出翻译成功的节点
     * 通过检查节点是否有翻译文本来判断
     * @param nodes 所有节点
     * @returns 翻译成功的节点列表
     */
    private filterSuccessfulNodes(nodes: TranslationNode[]): TranslationNode[] {
        return nodes.filter(node => {
            // 检查节点的翻译展示容器是否存在且有内容
            const displayNode = document.querySelector(
                `[data-translate-id="${node.id}"]`
            )

            if (!displayNode) {
                return false
            }

            // 检查是否有错误节点（翻译失败）
            const hasError = displayNode.querySelector(
                ".mewcat-error-container"
            )
            if (hasError) {
                if (this.debug) {
                    console.log(
                        `[MutationObserverManager] 过滤失败节点: ${node.id}`
                    )
                }
                return false
            }

            // 检查是否有翻译内容
            const hasTranslation = displayNode.querySelector("font")
            return !!hasTranslation
        })
    }

    /**
     * 为指定的节点列表添加监听器
     * 用于重试成功后动态添加监听
     * @param nodes 需要添加监听的节点列表
     */
    public addObserversForNodes(nodes: TranslationNode[]): void {
        if (!nodes || nodes.length === 0) {
            return
        }

        const successfulNodes = this.filterSuccessfulNodes(nodes)
        let addedCount = 0

        successfulNodes.forEach(node => {
            const container = node.container
            // 只为之前没有监听的容器添加监听
            if (container && !this.observedContainers.has(container)) {
                this.observeContainer(container, "retrySuccess")
                addedCount++
            }
        })

        if (this.debug && addedCount > 0) {
            console.log(
                `[MutationObserverManager] 为 ${addedCount} 个重试成功的节点添加了监听器`
            )
        }
    }

    /**
     * 为指定容器创建并启动 MutationObserver
     * @param container 要监听的容器元素
     * @param type 监听器类型（用于调试）
     */
    private observeContainer(
        container: HTMLElement,
        type: "sourceNode" | "globalContainer" | "retrySuccess"
    ): void {
        // 如果该容器已经有监听器，跳过
        if (this.observerMap.has(container)) {
            return
        }

        // 获取 MutationObserver 配置
        const config = this.getMutationObserverConfig()

        // 创建 observer 实例
        const observer = new MutationObserver(mutations => {
            this.handleMutations(mutations, container)
        })

        // 开始监听
        observer.observe(container, config)

        // 保存实例以便后续卸载
        this.observerMap.set(container, observer)
        this.observedContainers.add(container)
    }

    /**
     * 获取 MutationObserver 配置
     * 返回符合 MutationObserver 标准的配置
     */
    private getMutationObserverConfig(): MutationObserverInit {
        // 返回标准的 MutationObserver 配置
        return {
            // 监听子节点的变化
            childList: true,
            // 监听所有后代节点
            subtree: true,
            // 监听文本内容变化
            characterData: true,
            // 不监听属性变化（性能优化）
            attributes: false,
            // 不记录旧值（性能优化）
            characterDataOldValue: false,
            attributeOldValue: false
        }
    }

    /**
     * 处理 DOM 变化
     * 收集新增的节点和变化的容器
     * @param mutations 变化记录列表
     * @param container 发生变化的容器
     */
    private handleMutations(
        mutations: MutationRecord[],
        container: HTMLElement
    ): void {
        // 如果暂停监听，忽略所有变化
        if (this.isPaused) {
            return
        }

        // 将容器加入待处理集合
        this.pendingContainers.add(container)

        // 收集新增的节点（只收集元素节点，过滤文本节点等）
        mutations.forEach(mutation => {
            if (
                mutation.type === "childList" &&
                mutation.addedNodes.length > 0
            ) {
                mutation.addedNodes.forEach(node => {
                    // 只收集元素节点（ELEMENT_NODE = 1）
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.pendingAddedNodes.add(node)
                    }
                })
            }
        })

        // 清除之前的定时器
        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer)
        }

        // 获取防抖延迟时间（默认 10ms）
        const delay = this.config.changeDelay ?? 10

        // 设置新的防抖定时器
        this.debounceTimer = window.setTimeout(() => {
            this.processMutations()
        }, delay)
    }

    /**
     * 处理待处理的 DOM 变化
     * 传递发生变化的容器列表和新增节点列表给回调函数
     */
    private async processMutations(): Promise<void> {
        if (this.isProcessing) {
            if (this.debug) {
                console.log(
                    "[MutationObserverManager] 正在处理中，跳过本次变化"
                )
            }
            return
        }

        const changedContainers = Array.from(this.pendingContainers)
        this.pendingContainers.clear()
        this.pendingAddedNodes.clear()

        if (changedContainers.length === 0) {
            return
        }

        this.isProcessing = true

        try {
            if (this.debug) {
                console.log(
                    `[MutationObserverManager] 检测到 ${changedContainers.length} 个容器变化`,
                    {
                        changedContainers
                    }
                )
            }

            // 触发重新翻译回调，传递变化的容器列表和新增节点列表
            await this.onMutation(changedContainers)
        } catch (error) {
            console.error(
                "[MutationObserverManager] 处理 DOM 变化时出错:",
                error
            )
        } finally {
            this.isProcessing = false
        }
    }

    /**
     * 停止并卸载所有监听器
     * 清理所有资源
     */
    public destroy(): void {
        if (this.debug) {
            console.log("[MutationObserverManager] 卸载所有监听器...")
        }

        // 清除防抖定时器
        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer)
            this.debounceTimer = null
        }

        // 断开所有 observer
        this.observerMap.forEach(observer => {
            observer.disconnect()
        })

        // 清空所有状态
        this.observerMap.clear()
        this.observedContainers.clear()
        this.pendingContainers.clear()

        // 重置状态
        this.isProcessing = false

        if (this.debug) {
            console.log("[MutationObserverManager] 所有监听器已卸载")
        }
    }

    /**
     * 检查是否有活跃的监听器
     */
    public isActive(): boolean {
        return this.observerMap.size > 0
    }

    /**
     * 获取活跃的监听器数量
     */
    public getObserverCount(): number {
        return this.observerMap.size
    }

    /**
     * 暂停监听
     * 在执行翻译操作前调用，防止翻译引起的 DOM 变化触发监听器
     * 通过断开所有 observer 来丢弃所有待处理的 mutation records
     */
    public pause(): void {
        if (this.isPaused) {
            return // 已经暂停，避免重复操作
        }

        this.isPaused = true

        // 断开所有 observer，这会清空它们的 mutation records 队列
        this.observerMap.forEach(observer => {
            observer.disconnect()
        })

        if (this.debug) {
            console.log(
                "[MutationObserverManager] 监听已暂停，所有 observer 已断开"
            )
        }
    }

    /**
     * 恢复监听
     * 在翻译操作完成后调用
     * 重新连接所有 observer
     */
    public resume(): void {
        if (!this.isPaused) {
            return // 没有暂停，无需恢复
        }

        this.isPaused = false

        // 清空待处理容器和防抖定时器
        this.pendingContainers.clear()
        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer)
            this.debounceTimer = null
        }

        // 重新连接所有 observer
        const config = this.getMutationObserverConfig()
        this.observerMap.forEach((observer, container) => {
            observer.observe(container, config)
        })

        if (this.debug) {
            console.log(
                "[MutationObserverManager] 监听已恢复，所有 observer 已重新连接"
            )
        }
    }
}
