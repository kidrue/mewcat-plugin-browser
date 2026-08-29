/**
 * DOM操作相关工具函数
 * 包含元素文本提取、选择器匹配等功能
 */

import { getTranslationStyleCSS, type TranslationStyleUnion } from "./style"

export function isSelectionUiEvent(
    event: Pick<Event, "composedPath">,
    elements: ReadonlyArray<EventTarget | null | undefined>
): boolean {
    const selectionUiElements = new Set(
        elements.filter((element): element is EventTarget => Boolean(element))
    )
    return event
        .composedPath()
        .some(eventTarget => selectionUiElements.has(eventTarget))
}

export interface SelectionSnapshot {
    text: string
    rect: DOMRect
    startContainer: Node
    startOffset: number
    endContainer: Node
    endOffset: number
}

export function getSelectionSnapshot(
    selection: Pick<Selection, "toString" | "rangeCount" | "getRangeAt"> | null
): SelectionSnapshot | null {
    if (!selection || selection.rangeCount === 0) {
        return null
    }

    const text = selection.toString().trim()
    if (!text) {
        return null
    }

    const range = selection.getRangeAt(0)
    return {
        text,
        rect: range.getBoundingClientRect(),
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset
    }
}

const SELECTION_CONTEXT_SELECTOR =
    "p, li, blockquote, figcaption, td, th, article, section, main, div"

const normalizeSelectionContext = (value: string): string =>
    value.replace(/\s+/g, " ").trim()

const getSelectionStartIndex = (
    snapshot: SelectionSnapshot,
    contextElement: Element,
    context: string
): number | undefined => {
    try {
        const prefixRange = contextElement.ownerDocument.createRange()
        prefixRange.selectNodeContents(contextElement)
        prefixRange.setEnd(snapshot.startContainer, snapshot.startOffset)
        const normalizedPrefix = prefixRange
            .toString()
            .replace(/\s+/g, " ")
            .trimStart()
        return Math.min(normalizedPrefix.length, context.length)
    } catch {
        return undefined
    }
}

export function getSelectionContext(
    snapshot: SelectionSnapshot,
    maxLength = 500
): string {
    const startElement =
        snapshot.startContainer.nodeType === 1
            ? (snapshot.startContainer as Element)
            : snapshot.startContainer.parentElement
    const contextElement =
        startElement?.closest(SELECTION_CONTEXT_SELECTOR) ?? startElement
    const context = normalizeSelectionContext(
        contextElement?.textContent ?? snapshot.text
    )

    if (context.length <= maxLength) {
        return context
    }

    const selectedText = normalizeSelectionContext(snapshot.text)
    const selectedIndex =
        (contextElement &&
            getSelectionStartIndex(snapshot, contextElement, context)) ??
        context.indexOf(selectedText)
    if (selectedIndex < 0 || selectedText.length >= maxLength) {
        return context.slice(0, maxLength)
    }

    const surroundingLength = maxLength - selectedText.length
    let start = Math.max(0, selectedIndex - Math.floor(surroundingLength / 2))
    start = Math.min(start, context.length - maxLength)
    return context.slice(start, start + maxLength)
}

export function hasSelectionChanged(
    previous: SelectionSnapshot | null,
    current: SelectionSnapshot | null
): boolean {
    if (!current) {
        return false
    }
    if (!previous) {
        return true
    }

    return (
        current.text !== previous.text ||
        current.startContainer !== previous.startContainer ||
        current.startOffset !== previous.startOffset ||
        current.endContainer !== previous.endContainer ||
        current.endOffset !== previous.endOffset
    )
}

/**
 * 检查元素是否被全局排除规则排除
 */
export function isGloballyExcluded(
    element: Element,
    excludeSelectors: string[]
): boolean {
    return excludeSelectors.some(excludeSelector => {
        try {
            return (
                element.matches(excludeSelector) ||
                element.closest(excludeSelector)
            )
        } catch {
            return false
        }
    })
}

/**
 * 检查元素是否被规则特定排除选择器排除
 */
export function isExcludedByRuleSelectors(
    element: Element,
    excludeSelectors: string[]
): boolean {
    return excludeSelectors.some(excludeSelector => {
        try {
            return (
                element.matches(excludeSelector) ||
                element.closest(excludeSelector)
            )
        } catch {
            return false
        }
    })
}

/**
 * 创建翻译展示容器
 * 使用标准化的样式和属性，支持不同的翻译样式
 */
export function createTranslationContainerElement(
    targetLanguage: string,
    uniqueId: string,
    insertTagType: "nbsp" | "br"
): Element {
    // 根据样式选择合适的元素标签
    const containerElement = document.createElement("font")

    // 基础样式
    let cssText = `
     word-break: break-word;
    user-select: text;
    letter-spacing: normal!important;
     `

    // 如果是换行展示，添加上下 8px 外边距
    if (insertTagType === "br") {
        cssText += `
    margin-top: 8px;
    margin-bottom: 8px;
    display: block;
        `
    }

    containerElement.style.cssText = cssText
    containerElement.className = "notranslate mewcat-container"
    containerElement.setAttribute("data-lang", targetLanguage)
    containerElement.setAttribute("data-translate-id", uniqueId)

    if (insertTagType === "nbsp") {
        const fontElement = document.createElement("font")
        fontElement.innerHTML = "&nbsp;&nbsp;"
        containerElement.appendChild(fontElement)
    } else {
        const brElement = document.createElement("br")
        // 设置 br 标签行高为零，保留换行功能但不占用垂直空间
        brElement.style.cssText = `
            display: none
        `
        containerElement.appendChild(brElement)
    }

    return containerElement
}

/**
 * 创建翻译样式容器
 * @param text
 * @param style
 * @returns
 */
export function createTranslationDisplayElement(
    text: string,
    style: TranslationStyleUnion = "highlight"
): Element {
    // 根据样式选择合适的元素标签
    const translationElement = document.createElement("font")
    // 应用样式特定的CSS
    translationElement.style.cssText = getTranslationStyleCSS(style)
    translationElement.className = "mewcat-wrapper"
    translationElement.innerHTML = text
    return translationElement
}

export function createLoadingELement(size = 30) {
    // 创建旋转的loading元素
    const spinner = document.createElement("div")
    spinner.className = "meow-loading"
    spinner.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            border: 2px solid #e4ddcd;
            border-top: 2px solid #b23a2e;
            border-radius: 50%;
            display: inline-block;
            animation: spin 1s linear infinite;
        `

    // 创建动画样式
    const styleSheet = document.createElement("style")
    styleSheet.setAttribute("data-meow-loading-stylesheet", "1")

    const isCreatedLoadingStyleSheet = document.querySelector(
        "[data-meow-loading-stylesheet]"
    )

    if (!isCreatedLoadingStyleSheet) {
        styleSheet.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `
        document.head.appendChild(styleSheet)
    }

    return {
        spinner
    }
}

/**
 * 创建 SVG 图标元素
 * @param viewBox - SVG viewBox 属性
 * @param pathData - SVG path d 属性
 * @param size - 图标大小（像素）
 * @returns SVG 元素
 */
function createSVGIcon(
    viewBox: string,
    pathData: string,
    size = 14
): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("viewBox", viewBox)
    svg.setAttribute("fill", "none")
    svg.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        vertical-align: text-bottom;
    `

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", pathData)
    path.setAttribute("fill", "currentColor")
    svg.appendChild(path)

    return svg
}

/**
 * 创建翻译错误 UI（包含重试按钮和错误原因按钮）
 * @param errorType - 错误类型（如"网络错误"、"翻译失败"等）
 * @param errorDetails - 详细错误信息
 * @param onRetry - 点击重试按钮的回调函数
 * @returns 错误 UI 容器和相关方法
 */
export function createTranslationErrorUI(
    errorType: string,
    errorDetails: string,
    onRetry?: () => void | Promise<void>
): {
    errorContainer: HTMLElement
    showErrorDetails: () => void
    hideErrorDetails: () => void
} {
    // 创建错误容器
    const errorContainer = document.createElement("font")
    errorContainer.className = "mewcat-error-container"
    errorContainer.style.cssText = `
        margin-left: 4px;
        display:flex;
        align-items:center;
        white-space: nowrap;
    `

    // 通用按钮样式和悬停效果
    const createButton = (
        className: string,
        title: string,
        icon: SVGSVGElement,
        text: string
    ) => {
        const button = document.createElement("span")
        button.className = className
        button.style.cssText = `
            color: #b23a2e;
            cursor: pointer;
            user-select: none;
            ${className === "mewcat-retry-btn" ? "margin-right: 6px;" : ""}
            font-size: 0.75em;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 2px;
            transition: all 0.15s ease;
            padding: 2px 4px;
            border-radius: 6px;
        `
        button.setAttribute("title", title)
        button.appendChild(icon)
        button.appendChild(document.createTextNode(text))

        // 悬停效果
        button.addEventListener("mouseenter", () => {
            button.style.color = "#8e2a20"
            button.style.backgroundColor = "#f7efe6"
        })
        button.addEventListener("mouseleave", () => {
            button.style.color = "#b23a2e"
            button.style.backgroundColor = "transparent"
        })

        return button
    }

    // 创建重试按钮
    const retryButton = createButton(
        "mewcat-retry-btn",
        "重新翻译",
        createSVGIcon(
            "0 0 24 24",
            "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
            14
        ),
        " 重试"
    )

    // 重试按钮点击事件
    if (onRetry) {
        retryButton.addEventListener("click", async e => {
            e.stopPropagation()
            await onRetry()
        })
    }

    // 创建错误原因按钮
    const errorReasonButton = createButton(
        "mewcat-error-reason-btn",
        "查看错误详情",
        createSVGIcon(
            "0 0 1024 1024",
            "M512 1024c-281.6 0-512-230.4-512-512s230.4-512 512-512 512 230.4 512 512-230.4 512-512 512z m0-938.666667c-234.666667 0-426.666667 192-426.666667 426.666667s192 426.666667 426.666667 426.666667 426.666667-192 426.666667-426.666667-192-426.666667-426.666667-426.666667z m0 725.333334c-25.6 0-42.666667-17.066667-42.666667-42.666667v-298.666667c0-25.6 17.066667-42.666667 42.666667-42.666666s42.666667 17.066667 42.666667 42.666666v298.666667c0 21.333333-17.066667 42.666667-42.666667 42.666667z m0-567.466667c25.6 0 46.933333 21.333333 46.933333 46.933333s-21.333333 46.933333-46.933333 46.933334-46.933333-21.333333-46.933333-46.933334 21.333333-46.933333 46.933333-46.933333z",
            12
        ),
        " 错误原因"
    )
    // 创建错误详情弹窗
    const errorModal = document.createElement("div")
    errorModal.className = "mewcat-error-modal"
    errorModal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(26, 23, 20, 0.46);
        backdrop-filter: blur(4px);
        z-index: 999999;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.2s ease;
    `

    // 错误详情内容区域
    const errorModalContent = document.createElement("div")
    errorModalContent.className = "mewcat-error-modal-content"
    errorModalContent.style.cssText = `
        background: #fbf8f0;
        padding: 24px;
        border-radius: 16px;
        border: 1px solid #d8d0be;
        box-shadow: 0 10px 34px rgba(26, 23, 20, 0.18);
        max-width: 500px;
        min-width: 400px;
        position: relative;
        animation: slideUp 0.3s ease;
    `

    // 关闭按钮
    const closeButton = document.createElement("button")
    closeButton.className = "mewcat-error-modal-close"
    closeButton.innerHTML = "✕"
    closeButton.style.cssText = `
        position: absolute;
        top: 16px;
        right: 16px;
        background: transparent;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #9a9188;
        padding: 4px 8px;
        border-radius: 8px;
        transition: all 0.15s ease;
        line-height: 1;
    `
    closeButton.addEventListener("mouseenter", () => {
        closeButton.style.color = "#1a1714"
        closeButton.style.backgroundColor = "#eae3d4"
    })
    closeButton.addEventListener("mouseleave", () => {
        closeButton.style.color = "#9a9188"
        closeButton.style.backgroundColor = "transparent"
    })

    // 错误类型标题
    const errorTypeTitle = document.createElement("h3")
    errorTypeTitle.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
        color: #a5342a;
        display: flex;
        align-items: center;
        gap: 8px;
    `
    errorTypeTitle.textContent = errorType

    // 错误详情内容
    const errorDetailsContent = document.createElement("div")
    errorDetailsContent.style.cssText = `
        color: #4a443c;
        font-size: 14px;
        line-height: 1.6;
        word-break: break-word;
        max-height: 300px;
        overflow-y: auto;
        padding: 12px;
        background: #f2ede1;
        border-radius: 12px;
        border: 1px solid #ded5c3;
    `
    errorDetailsContent.textContent = errorDetails

    // 组装弹窗内容
    errorModalContent.appendChild(closeButton)
    errorModalContent.appendChild(errorTypeTitle)
    errorModalContent.appendChild(errorDetailsContent)
    errorModal.appendChild(errorModalContent)

    // 显示/隐藏弹窗的方法
    const showErrorDetails = () => {
        // 注入动画样式（如果还没有注入）
        if (!document.getElementById("mewcat-error-modal-animations")) {
            const style = document.createElement("style")
            style.id = "mewcat-error-modal-animations"
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `
            document.head.appendChild(style)
        }

        errorModal.style.display = "flex"
        document.body.appendChild(errorModal)
    }

    const hideErrorDetails = () => {
        errorModal.style.display = "none"
        if (errorModal.parentNode) {
            errorModal.parentNode.removeChild(errorModal)
        }
    }

    // 点击关闭按钮关闭弹窗
    closeButton.addEventListener("click", e => {
        e.stopPropagation()
        hideErrorDetails()
    })

    // 点击弹窗外部关闭弹窗
    errorModal.addEventListener("click", e => {
        if (e.target === errorModal) {
            hideErrorDetails()
        }
    })

    // 点击错误原因按钮显示弹窗
    errorReasonButton.addEventListener("click", e => {
        e.stopPropagation()
        showErrorDetails()
    })

    // 组装错误容器
    errorContainer.appendChild(retryButton)
    errorContainer.appendChild(errorReasonButton)

    return {
        errorContainer,
        showErrorDetails,
        hideErrorDetails
    }
}

/**
 * 安全地移除DOM元素
 */
export function safeRemoveElement(element: Element): void {
    try {
        if (element?.parentNode) {
            element.parentNode.removeChild(element)
        }
    } catch (error) {
        console.warn("移除元素失败:", error)
    }
}

//边界计算，得出选中内容的边界
/**
 * 计算元素b相对于锚点a的合适位置
 * @param a 锚点元素的位置信息
 * @param b 需要定位的元素的位置信息
 * @returns 包含top和left的位置对象
 */
export function calculatePosition(
    aRect: DOMRect,
    bRect: DOMRect,
    options?: {
        offset?: {
            x?: number
            y?: number
        }
    }
): { top: number; left: number } {
    const { offset } = options || {}
    const { x: offsetX = 0, y: offsetY = 16 } = offset || {}
    // 获取窗口尺寸
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    // 基础位置：b在a的正下方，左对齐
    let top = aRect.top + aRect.height
    let left = aRect.left

    // 检查b的高度是否超出a的高度和y坐标总和
    // 如果超出，则翻转到a的上方
    const isOverturn = bRect.height + aRect.top + aRect.height > windowHeight
    if (isOverturn) {
        top = aRect.top - bRect.height
    }

    // 检查b的右侧是否超出窗口宽度
    // 如果超出，则让b的右侧紧贴窗口右侧
    const bRight = aRect.left + bRect.width
    if (bRight > windowWidth) {
        left = windowWidth - bRect.width
    }

    if (offsetX || offsetY) {
        top = (isOverturn ? -offsetY : offsetY) + top || 0
        left += offsetX || 0
    }

    const viewportMargin = 8
    const maxLeft = Math.max(
        viewportMargin,
        windowWidth - bRect.width - viewportMargin
    )
    const maxTop = Math.max(
        viewportMargin,
        windowHeight - bRect.height - viewportMargin
    )
    left = Math.min(Math.max(left, viewportMargin), maxLeft)
    top = Math.min(Math.max(top, viewportMargin), maxTop)

    return { top, left }
}

/**
 * 插入到指定节点的后面
 * @param {Node} newNode - 要插入的新节点
 * @param {Node} targetNode - 目标节点（插入到这个节点后面）
 */
export function insertAfter(newNode: Element, targetNode: HTMLElement) {
    const parent = targetNode.parentNode
    // 若目标节点是最后一个子节点，直接插最后；否则插在目标节点的下一个兄弟节点前
    if (parent) {
        parent.insertBefore(newNode, targetNode.nextSibling)
    }
}

export function setTranslateUniqueId(ele: Element, uniqueId: string) {
    ele.setAttribute("data-mewcat-parent-node-id", uniqueId)
    return uniqueId
}
