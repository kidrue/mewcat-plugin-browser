/**
 * ImmersiveTranslator 调试工具
 * 提供规则匹配、DOM节点、翻译状态等调试信息
 */

import type { TranslationRule } from "../types"

export interface DebugNodeInfo {
    /** 原始DOM节点 */
    sourceElement: HTMLElement
    /** 翻译展示DOM节点 */
    translationElement?: HTMLElement
    /** 匹配的规则信息 */
    matchedRule?: TranslationRule
    /** 匹配的具体选择器 */
    matchedSelector?: string
    /** 节点的唯一标识 */
    uniqueId: string
    /** 节点文本内容 */
    textContent: string
    /** 翻译后的文本 */
    translatedText?: string
    /** 节点在页面中的XPath */
    xpath: string
    /** CSS选择器路径 */
    cssSelector: string
    /** 节点的DOM层级深度 */
    depth: number
    /** 是否可见 */
    isVisible: boolean
    /** 节点的规则优先级 */
    priority: number
    /** 匹配时间戳 */
    matchedAt: number
}

export interface DebugRuleInfo {
    /** 规则对象 */
    rule: TranslationRule
    /** 该规则匹配的节点数量 */
    matchedNodesCount: number
    /** 匹配的节点列表 */
    matchedNodes: HTMLElement[]
    /** 规则的选择器列表 */
    selectors: string[]
    /** 排除选择器列表 */
    excludeSelectors?: string[]
    /** 是否启用 */
    isEnabled: boolean
    /** 匹配失败的选择器（语法错误等） */
    failedSelectors: string[]
}

export interface DebugSummary {
    /** 当前活跃的规则数量 */
    activeRulesCount: number
    /** 匹配到的节点总数 */
    totalMatchedNodes: number
    /** 成功翻译的节点数量 */
    translatedNodesCount: number
    /** 翻译失败的节点数量 */
    failedNodesCount: number
    /** 当前使用的翻译样式 */
    translationStyle: string
    /** 目标语言 */
    targetLanguage: string
    /** 页面域名 */
    hostname: string
    /** 页面标题 */
    pageTitle: string
    /** 是否正在翻译 */
    isTranslating: boolean
    /** 调试模式是否启用 */
    debugEnabled: boolean
    /** 总耗时（毫秒） */
    totalElapsedTime: number
    /** 翻译开始时间 */
    translationStartTime?: number
}

/**
 * 获取元素的XPath路径（调试用）
 */
export function getDebugElementXPath(element: HTMLElement): string {
    if (element.id) {
        return `//*[@id="${element.id}"]`
    }

    const path: string[] = []
    let current: Element | null = element

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.tagName.toLowerCase()

        if (current.className) {
            const classes = current.className
                .trim()
                .replace(/\s+/g, ".")
                .replace(/^\.?/, ".")
            if (classes.length > 1) {
                selector += classes
            }
        }

        // 获取同级元素中的位置
        const siblings = Array.from(current.parentElement?.children || [])
        const sameTagSiblings = siblings.filter(
            sibling => sibling.tagName === current!.tagName
        )

        if (sameTagSiblings.length > 1) {
            const index = sameTagSiblings.indexOf(current) + 1
            selector += `[${index}]`
        }

        path.unshift(selector)
        current = current.parentElement
    }

    return "/" + path.join("/")
}

/**
 * 获取元素的CSS选择器路径
 */
export function getElementCSSSelector(element: HTMLElement): string {
    if (element.id) {
        return `#${element.id}`
    }

    const path: string[] = []
    let current: Element | null = element

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.tagName.toLowerCase()

        if (current.className) {
            const classes = current.className.trim().replace(/\s+/g, ".")
            if (classes) {
                selector += `.${classes}`
            }
        }

        // 获取nth-child位置
        const parent = current.parentElement
        if (parent) {
            const siblings = Array.from(parent.children)
            const index = siblings.indexOf(current) + 1
            selector += `:nth-child(${index})`
        }

        path.unshift(selector)
        current = current.parentElement

        // 如果已经足够唯一，就不需要继续向上
        if (
            path.length > 0 &&
            document.querySelectorAll(path.join(" > ")).length === 1
        ) {
            break
        }
    }

    return path.join(" > ")
}

/**
 * 计算DOM元素的深度
 */
export function getElementDepth(element: HTMLElement): number {
    let depth = 0
    let current = element.parentElement

    while (current && current !== document.body) {
        depth++
        current = current.parentElement
    }

    return depth
}

/**
 * 检查元素是否可见
 */
export function isElementVisible(element: Element): boolean {
    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()

    return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
    )
}

/**
 * 格式化调试信息为表格数据
 */
export function formatDebugDataForConsole(debugNodes: DebugNodeInfo[]): void {
    console.group("🔍 ImmersiveTranslator Debug Information")

    console.table(
        debugNodes.map(node => ({
            节点: node.sourceElement.tagName.toLowerCase(),
            规则ID: node.matchedRule?.id || "N/A",
            选择器: node.matchedSelector || "N/A",
            优先级: node.priority,
            文本内容:
                node.textContent.substring(0, 50) +
                (node.textContent.length > 50 ? "..." : ""),
            翻译状态: node.translatedText ? "✅ 已翻译" : "⏳ 待翻译",
            可见性: node.isVisible ? "👁️ 可见" : "🙈 隐藏",
            深度: node.depth
        }))
    )

    console.groupEnd()
}

/**
 * 格式化规则调试信息
 */
export function formatRuleDebugInfo(debugRules: DebugRuleInfo[]): void {
    console.group("📋 Translation Rules Debug Information")

    debugRules.forEach(ruleInfo => {
        console.group(`📝 Rule: ${ruleInfo.rule.id}`)
        console.log("✅ 匹配节点数:", ruleInfo.matchedNodesCount)
        console.log("🎯 选择器:", ruleInfo.selectors)
        if (ruleInfo.excludeSelectors?.length) {
            console.log("🚫 排除选择器:", ruleInfo.excludeSelectors)
        }
        if (ruleInfo.failedSelectors.length) {
            console.warn("❌ 失败选择器:", ruleInfo.failedSelectors)
        }
        console.log("🔧 启用状态:", ruleInfo.isEnabled ? "✅ 启用" : "❌ 禁用")
        console.groupEnd()
    })

    console.groupEnd()
}

/**
 * 高亮显示调试节点
 */
export function highlightDebugNode(
    element: HTMLElement,
    color = "#ff6b6b",
    duration = 3000
): void {
    const originalStyle = {
        outline: element.style.outline,
        outlineOffset: element.style.outlineOffset,
        backgroundColor: element.style.backgroundColor
    }

    // 添加高亮样式
    element.style.outline = `2px solid ${color}`
    element.style.outlineOffset = "2px"
    element.style.backgroundColor = `${color}20`

    // 一段时间后恢复原样式
    setTimeout(() => {
        element.style.outline = originalStyle.outline
        element.style.outlineOffset = originalStyle.outlineOffset
        element.style.backgroundColor = originalStyle.backgroundColor
    }, duration)
}

/**
 * 创建调试面板DOM元素
 */
export function createDebugPanel(): HTMLElement {
    const panel = document.createElement("div")
    panel.id = "immersive-translator-debug-panel"
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        max-height: 600px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        border: 1px solid #333;
        border-radius: 16px;
        font-family: monospace;
        font-size: 12px;
        z-index: 999999;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
    `

    // 添加展开/收起状态数据 - 默认为收起状态
    panel.dataset.collapsed = "false"

    return panel
}

/**
 * 更新调试面板内容
 */
export function updateDebugPanel(
    panel: HTMLElement,
    summary: DebugSummary,
    nodes: DebugNodeInfo[]
): void {
    const isCollapsed = panel.dataset.collapsed === "true"

    panel.innerHTML = `
        <div style="padding: 15px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${isCollapsed ? "0" : "15px"};">
                <h3 style="margin: 0; color: #4CAF50; flex: 1;">🔍 ImmersiveTranslator Debug</h3>
                <button id="debug-toggle-btn" 
                        style="background: #666; color: white; border: none; padding: 4px 8px; border-radius: 8px; cursor: pointer; font-size: 10px; margin-left: 10px;">
                    ${isCollapsed ? "▼ 展开" : "▲ 收起"}
                </button>
            </div>
            
            <div id="debug-panel-content" style="display: ${isCollapsed ? "none" : "block"}; overflow-y: auto; max-height: 520px;">
                <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #333;">
                    <div><strong>页面:</strong> ${summary.pageTitle}</div>
                    <div><strong>域名:</strong> ${summary.hostname}</div>
                    <div><strong>翻译状态:</strong> ${summary.isTranslating ? "🔄 翻译中" : "✅ 完成"}</div>
                    <div><strong>样式:</strong> ${summary.translationStyle}</div>
                    <div><strong>目标语言:</strong> ${summary.targetLanguage}</div>
                </div>
                
                <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #333;">
                    <h4 style="margin: 0 0 5px 0; color: #2196F3;">📊 统计信息</h4>
                    <div><strong>活跃规则:</strong> ${summary.activeRulesCount}</div>
                    <div><strong>匹配节点:</strong> ${summary.totalMatchedNodes}</div>
                    <div><strong>已翻译:</strong> ${summary.translatedNodesCount}</div>
                    <div><strong>翻译失败:</strong> ${summary.failedNodesCount}</div>
                    ${summary.totalElapsedTime > 0 ? `<div><strong>耗时:</strong> ${summary.totalElapsedTime}ms</div>` : ""}
                </div>
                
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #FF9800;">🎯 节点详情</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${nodes
                            .map(
                                (node, index) => `
                            <div style="margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer;"
                                 onclick="window.immersiveTranslatorDebug?.highlightNode(${index})">
                                <div><strong>${node.sourceElement.tagName.toLowerCase()}</strong> 
                                     ${node.isVisible ? "👁️" : "🙈"} 
                                     ${node.translatedText ? "✅" : "⏳"}</div>
                                <div style="font-size: 10px; color: #ccc;">
                                    规则: ${node.matchedRule?.id || "N/A"} | 
                                    优先级: ${node.priority} | 
                                    深度: ${node.depth}
                                </div>
                                <div style="font-size: 10px; color: #888; margin-top: 3px;">
                                    ${node.textContent.substring(0, 60)}${node.textContent.length > 60 ? "..." : ""}
                                </div>
                                ${
                                    node.matchedSelector
                                        ? `
                                    <div style="font-size: 9px; color: #4CAF50; margin-top: 2px;">
                                        选择器: ${node.matchedSelector}
                                    </div>
                                `
                                        : ""
                                }
                            </div>
                        `
                            )
                            .join("")}
                    </div>
                </div>
                
                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #333; text-align: center;">
                    <button onclick="window.immersiveTranslatorDebug?.closePanel()" 
                            style="background: #f44336; color: white; border: none; padding: 5px 15px; border-radius: 8px; cursor: pointer;">
                        关闭面板
                    </button>
                    <button onclick="window.immersiveTranslatorDebug?.exportDebugData()" 
                            style="background: #4CAF50; color: white; border: none; padding: 5px 15px; border-radius: 8px; cursor: pointer; margin-left: 5px;">
                        导出数据
                    </button>
                </div>
            </div>
        </div>
    `

    // 根据收起状态调整面板高度
    if (isCollapsed) {
        panel.style.height = "auto"
        panel.style.maxHeight = "60px"
    } else {
        panel.style.height = "auto"
        panel.style.maxHeight = "600px"
    }

    // 添加切换按钮事件监听器
    const toggleButton = panel.querySelector(
        "#debug-toggle-btn"
    ) as HTMLButtonElement
    if (toggleButton) {
        // 移除现有的onclick属性处理器
        toggleButton.onclick = null

        // 添加直接的事件监听器
        toggleButton.addEventListener("click", e => {
            e.preventDefault()
            e.stopPropagation()
            console.log("Toggle button clicked via event listener")
            toggleDebugPanel()
        })

        console.log("✅ Toggle button event listener added")
    } else {
        console.warn("❌ Toggle button not found for event listener")
    }
}

/**
 * 切换调试面板的展开/收起状态
 */
export function toggleDebugPanel(): void {
    console.log("toggleDebugPanel called")

    const panel = document.getElementById("immersive-translator-debug-panel")
    if (!panel) {
        console.warn("Debug panel not found")
        return
    }

    // 切换收起状态
    const isCurrentlyCollapsed = panel.dataset.collapsed === "true"
    const newCollapsedState = !isCurrentlyCollapsed
    panel.dataset.collapsed = String(newCollapsedState)

    console.log("Toggle state:", {
        isCurrentlyCollapsed,
        newCollapsedState,
        datasetValue: panel.dataset.collapsed
    })

    const content = panel.querySelector("#debug-panel-content") as HTMLElement
    const toggleButton = panel.querySelector("#debug-toggle-btn") as HTMLElement
    const headerContainer = panel.querySelector("div > div") as HTMLElement

    if (!content) {
        console.warn("Debug panel content not found")
        return
    }

    if (!toggleButton) {
        console.warn("Debug toggle button not found")
        return
    }

    if (newCollapsedState) {
        // 收起面板
        content.style.display = "none"
        panel.style.maxHeight = "60px"
        toggleButton.innerHTML = "▼ 展开"
        if (headerContainer) {
            headerContainer.style.marginBottom = "0"
        }
    } else {
        // 展开面板
        content.style.display = "block"
        panel.style.maxHeight = "600px"
        toggleButton.innerHTML = "▲ 收起"
        if (headerContainer) {
            headerContainer.style.marginBottom = "15px"
        }
    }

    console.log("Debug panel toggled successfully:", {
        collapsed: newCollapsedState,
        contentDisplay: content.style.display,
        panelMaxHeight: panel.style.maxHeight
    })
}

/**
 * 导出调试数据为JSON
 */
export function exportDebugData(
    summary: DebugSummary,
    nodes: DebugNodeInfo[],
    rules: DebugRuleInfo[]
): void {
    const debugData = {
        timestamp: new Date().toISOString(),
        summary,
        nodes: nodes.map(node => ({
            ...node,
            sourceElement: `<${node.sourceElement.tagName.toLowerCase()}>${node.sourceElement.outerHTML.substring(0, 200)}...`,
            translationElement: node.translationElement
                ? `<${node.translationElement.tagName.toLowerCase()}>`
                : undefined
        })),
        rules: rules.map(rule => ({
            ...rule,
            matchedNodes: rule.matchedNodes.map(
                node => `<${node.tagName.toLowerCase()}>`
            )
        }))
    }

    const blob = new Blob([JSON.stringify(debugData, null, 2)], {
        type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `immersive-translator-debug-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
