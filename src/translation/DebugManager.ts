import { getElementText } from "@/utils"
import { isElementVisible } from "@/utils/debugUtils"

import type { TranslationRule } from "../types"

/**
 * 调试管理器
 * 负责管理翻译过程中的调试功能，包括可视化标记、日志输出等
 */
export class DebugManager {
    /** 调试模式标志 */
    private debugMode: boolean = false

    /** 调试序号标签列表 */
    private debugSequenceLabels: Element[] = []

    /** 可视区域节点列表 */
    private visibleNodes: Element[] = []

    /** 非可视区域节点列表 */
    private nonVisibleNodes: Element[] = []

    /** 所有源文本节点列表 */
    private sourceTextNodes: Element[] = []

    constructor(debugMode: boolean = false) {
        this.debugMode = debugMode
    }

    /**
     * 启用调试模式
     */
    public enableDebugMode(): void {
        this.debugMode = true
        console.log("🔍 ImmersiveTranslator Debug Mode Enabled")
    }

    /**
     * 禁用调试模式
     */
    public disableDebugMode(): void {
        this.debugMode = false
        console.log("🔍 ImmersiveTranslator Debug Mode Disabled")
    }

    /**
     * 检查是否启用调试模式
     */
    public isDebugMode(): boolean {
        return this.debugMode
    }

    /**
     * 输出调试日志
     * @param message - 日志消息
     * @param args - 额外参数
     */
    public log(message: string, ...args: unknown[]): void {
        if (this.debugMode) {
            console.log(message, ...args)
        }
    }

    /**
     * 标记所有节点的翻译顺序
     * 在每个待翻译节点上添加序号标签，显示翻译顺序
     * @param sourceTextNodes - 所有源文本节点
     * @param visibleNodes - 可视区域节点
     * @param nonVisibleNodes - 非可视区域节点
     * @param prioritizeVisibleArea - 是否优先翻译可视区域
     */
    public markTranslationSequence(
        sourceTextNodes: Element[],
        visibleNodes: Element[],
        nonVisibleNodes: Element[],
        prioritizeVisibleArea: boolean
    ): void {
        this.sourceTextNodes = sourceTextNodes
        this.visibleNodes = visibleNodes
        this.nonVisibleNodes = nonVisibleNodes

        // 清理之前的序号标签
        this.clearDebugSequenceLabels()

        // 创建样式（如果还没有）
        this.createDebugStyles()

        // 为所有节点添加序号
        console.group("📝 所有节点翻译顺序（按DOM树顺序）")

        if (prioritizeVisibleArea) {
            // 先标记可视区域节点
            this.visibleNodes.forEach((node, index) => {
                const sequenceNum = index + 1
                this.addSequenceLabel(
                    node,
                    sequenceNum,
                    "debug-sequence-label visible-area"
                )
                node.classList.add("debug-node-highlight", "visible-area")
            })

            // 再标记非可视区域节点
            this.nonVisibleNodes.forEach((node, index) => {
                const sequenceNum = this.visibleNodes.length + index + 1
                this.addSequenceLabel(
                    node,
                    sequenceNum,
                    "debug-sequence-label non-visible-area"
                )
                node.classList.add("debug-node-highlight", "non-visible-area")
            })

            // 显示分区信息
            if (
                this.visibleNodes.length > 0 ||
                this.nonVisibleNodes.length > 0
            ) {
                console.group("🎯 可视/非可视区域节点分布情况")
                console.log(`可视区域节点: ${this.visibleNodes.length} 个`)
                console.log(`非可视区域节点: ${this.nonVisibleNodes.length} 个`)

                if (this.visibleNodes.length > 0) {
                    const visibleIndices = this.visibleNodes
                        .map(node => this.sourceTextNodes.indexOf(node) + 1)
                        .filter(index => index > 0)
                    console.log(
                        `可视区域节点序号: [${visibleIndices.join(", ")}]`
                    )
                }
                if (this.nonVisibleNodes.length > 0) {
                    const nonVisibleIndices = this.nonVisibleNodes
                        .map(node => this.sourceTextNodes.indexOf(node) + 1)
                        .filter(index => index > 0)
                    console.log(
                        `非可视区域节点序号: [${nonVisibleIndices.join(", ")}]`
                    )
                }
                console.groupEnd()
            }
        } else {
            this.sourceTextNodes.forEach((node, index) => {
                const sequenceNum = index + 1
                this.addSequenceLabel(
                    node,
                    sequenceNum,
                    "debug-sequence-label all"
                )
                node.classList.add("debug-node-highlight")

                const tagName = node.tagName.toLowerCase()
                const className = node.className
                    ? `.${node.className.split(" ").join(".")}`
                    : ""
                const nodeInfo = `${tagName}${className}`

                console.log(
                    `  #${sequenceNum}: [${nodeInfo}] ${node.textContent?.substring(0, 50)}...`
                )
            })
        }

        console.groupEnd()
        console.log(
            `📊 总计标记了 ${this.debugSequenceLabels.length} 个节点的翻译顺序`
        )
    }

    /**
     * 创建调试样式
     * @private
     */
    private createDebugStyles(): void {
        if (!document.querySelector("#debug-sequence-style")) {
            const style = document.createElement("style")
            style.id = "debug-sequence-style"
            style.textContent = `
                .debug-sequence-label {
                    position: absolute;
                    left: 40px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 9999px;
                    z-index: 10000;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    pointer-events: none;
                    animation: sequence-label-pulse 2s ease-in-out infinite;
                    font-family: monospace;
                    min-width: 20px;
                    text-align: center;
                }
                .debug-sequence-label.visible-area {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                }
                .debug-sequence-label.non-visible-area {
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                }
                @keyframes sequence-label-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                .debug-node-highlight {
                    outline: 2px solid #667eea !important;
                    outline-offset: 2px !important;
                    background-color: rgba(102, 126, 234, 0.1) !important;
                    position: relative !important;
                }
                .debug-node-highlight.visible-area {
                    outline-color: #f5576c !important;
                    background-color: rgba(245, 87, 108, 0.1) !important;
                }
                .debug-node-highlight.non-visible-area {
                    outline-color: #4facfe !important;
                    background-color: rgba(79, 172, 254, 0.1) !important;
                }
            `
            document.head.appendChild(style)
        }
    }

    /**
     * 为节点添加序号标签
     * @private
     */
    private addSequenceLabel(
        node: Element,
        sequence: number,
        className: string
    ): void {
        const label = document.createElement("div")
        label.className = className
        label.textContent = sequence.toString()

        // 获取节点位置
        const rect = node.getBoundingClientRect()
        const scrollTop =
            window.pageYOffset || document.documentElement.scrollTop
        const scrollLeft =
            window.pageXOffset || document.documentElement.scrollLeft

        // 设置标签位置（在节点左上角）
        label.style.position = "absolute"
        label.style.left = `${rect.left + scrollLeft - 25 + 20}px`
        label.style.top = `${rect.top + scrollTop - 10}px`

        // 添加到页面
        document.body.appendChild(label)
        this.debugSequenceLabels.push(label)

        // 存储序号到节点属性中
        node.setAttribute("data-debug-sequence", sequence.toString())
    }

    /**
     * 清理所有序号标签
     */
    public clearDebugSequenceLabels(): void {
        // 移除所有序号标签
        this.debugSequenceLabels.forEach(label => {
            if (label.parentNode) {
                label.parentNode.removeChild(label)
            }
        })
        this.debugSequenceLabels = []

        // 移除高亮样式
        document.querySelectorAll(".debug-node-highlight").forEach(node => {
            node.classList.remove(
                "debug-node-highlight",
                "visible-area",
                "non-visible-area"
            )
        })

        // 移除序号属性
        document.querySelectorAll("[data-debug-sequence]").forEach(node => {
            node.removeAttribute("data-debug-sequence")
        })
    }

    /**
     * 显示选择器 DOM 获取详情
     * @param domainRules - 当前域名的规则列表
     */
    public showSelectorDOMDetails(domainRules: TranslationRule[]): void {
        if (!this.debugMode) {
            return
        }

        console.group("🎯 选择器DOM获取详情")

        domainRules.forEach((rule, ruleIndex) => {
            console.group(`规则 ${ruleIndex + 1}: ${rule.id}`)

            rule.selectors.forEach((selector, selectorIndex) => {
                try {
                    const elements = document.querySelectorAll(selector)
                    console.log(`选择器 ${selectorIndex + 1}: ${selector}`)
                    console.log(`  获取到 ${elements.length} 个DOM元素`)

                    if (elements.length > 0) {
                        const elementDetails = Array.from(elements).map(
                            (el, index) => {
                                const element = el as Element
                                return {
                                    序号: index + 1,
                                    标签: element.tagName.toLowerCase(),
                                    类名: element.className || "无",
                                    文本预览:
                                        getElementText(element).substring(
                                            0,
                                            50
                                        ) + "...",
                                    可见性: isElementVisible(element)
                                        ? "可见"
                                        : "不可见"
                                }
                            }
                        )

                        console.table(elementDetails)
                    }
                } catch (error) {
                    console.error(`  选择器执行失败: ${error.message}`)
                }
            })

            console.groupEnd()
        })

        console.groupEnd()
    }

    /**
     * 验证 DOM 排序是否正确
     * @param sourceTextNodes - 所有源文本节点
     * @param visibleNodes - 可视区域节点
     * @param nonVisibleNodes - 非可视区域节点
     * @param sortNodesByDOMOrder - 排序函数
     */
    public validateDOMOrder(
        sourceTextNodes: Element[],
        visibleNodes: Element[],
        nonVisibleNodes: Element[],
        sortNodesByDOMOrder: (nodes: Element[]) => Element[]
    ): void {
        if (!this.debugMode) {
            console.warn("请先启用调试模式: debugManager.enableDebugMode()")
            return
        }

        console.group("🔍 DOM排序验证")

        // 显示原始sourceTextNodes的顺序
        console.log("原始 sourceTextNodes 顺序:")
        sourceTextNodes.forEach((node, index) => {
            const tagName = node.tagName.toLowerCase()
            const className = node.className
                ? `.${node.className.split(" ").join(".")}`
                : ""
            const nodeInfo = `${tagName}${className}`
            console.log(
                `  ${index + 1}: [${nodeInfo}] ${node.textContent?.substring(0, 30)}...`
            )
        })

        if (visibleNodes.length > 0 || nonVisibleNodes.length > 0) {
            console.log("\n可视区域节点顺序:")
            visibleNodes.forEach((node, index) => {
                const tagName = node.tagName.toLowerCase()
                const className = node.className
                    ? `.${node.className.split(" ").join(".")}`
                    : ""
                const nodeInfo = `${tagName}${className}`
                const originalIndex = sourceTextNodes.indexOf(node) + 1
                console.log(
                    `  ${index + 1}: [${nodeInfo}] (原序号: ${originalIndex}) ${node.textContent?.substring(0, 30)}...`
                )
            })

            console.log("\n非可视区域节点顺序:")
            nonVisibleNodes.forEach((node, index) => {
                const tagName = node.tagName.toLowerCase()
                const className = node.className
                    ? `.${node.className.split(" ").join(".")}`
                    : ""
                const nodeInfo = `${tagName}${className}`
                const originalIndex = sourceTextNodes.indexOf(node) + 1
                console.log(
                    `  ${index + 1}: [${nodeInfo}] (原序号: ${originalIndex}) ${node.textContent?.substring(0, 30)}...`
                )
            })
        }

        // 验证排序是否保持DOM顺序
        const testSortedNodes = sortNodesByDOMOrder([...sourceTextNodes])
        const isSorted = testSortedNodes.every(
            (node, index) => node === sourceTextNodes[index]
        )
        console.log(`\n✅ DOM顺序验证: ${isSorted ? "正确" : "❌ 错误"}`)

        console.groupEnd()
    }
}
