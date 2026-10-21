/**
 * XPath 解析相关的工具函数
 */

/**
 * XPath 解析异常类
 */
export class XPathError extends Error {
    constructor(
        message: string,
        public readonly xpath?: string
    ) {
        super(message)
        this.name = "XPathError"
    }
}

/**
 * XPath 解析选项
 */
export interface XPathOptions {
    /** 是否返回第一个匹配的元素 */
    single?: boolean
    /** 结果类型 */
    resultType?: number
    /** 上下文节点，默认为 document */
    contextNode?: Node
}

/**
 * 使用 XPath 表达式查询 DOM 元素
 * @param xpath XPath 表达式
 * @param options 解析选项
 * @returns 匹配的元素或元素数组
 */
export function evaluateXPath(
    xpath: string,
    options: XPathOptions & { single: true }
): Element | null
export function evaluateXPath(xpath: string, options?: XPathOptions): Element[]
export function evaluateXPath(
    xpath: string,
    options: XPathOptions = {}
): Element | Element[] | null {
    // 参数验证
    if (!xpath || typeof xpath !== "string") {
        throw new XPathError(
            "XPath expression must be a non-empty string",
            xpath
        )
    }

    try {
        const {
            single = false,
            resultType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            contextNode = document
        } = options

        // 检查浏览器是否支持 XPath
        if (!document.evaluate) {
            throw new XPathError("XPath is not supported in this browser")
        }

        // 验证上下文节点
        if (!contextNode || !(contextNode instanceof Node)) {
            throw new XPathError("Context node must be a valid Node", xpath)
        }

        // 执行 XPath 查询
        const result = document.evaluate(
            xpath,
            contextNode,
            null,
            single ? XPathResult.FIRST_ORDERED_NODE_TYPE : resultType,
            null
        )

        if (single) {
            const node = result.singleNodeValue
            return node instanceof Element ? node : null
        }

        // 收集所有匹配的元素
        const elements: Element[] = []
        for (let i = 0; i < result.snapshotLength; i++) {
            const node = result.snapshotItem(i)
            if (node instanceof Element) {
                elements.push(node)
            }
        }

        return elements
    } catch (error) {
        if (error instanceof XPathError) {
            throw error
        }

        // 处理原生 XPath 错误
        if (error instanceof DOMException) {
            throw new XPathError(
                `Invalid XPath expression: ${error.message}`,
                xpath
            )
        }

        // 其他未知错误
        throw new XPathError(
            `XPath evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            xpath
        )
    }
}

/**
 * 查询单个元素（evaluateXPath 的简化版本）
 * @param xpath XPath 表达式
 * @param contextNode 上下文节点，默认为 document
 * @returns 第一个匹配的元素或 null
 */
export function querySelector(
    xpath: string,
    contextNode?: Node
): Element | null {
    return evaluateXPath(xpath, { single: true, contextNode })
}

/**
 * 查询所有匹配的元素（evaluateXPath 的简化版本）
 * @param xpath XPath 表达式
 * @param contextNode 上下文节点，默认为 document
 * @returns 匹配的元素数组
 */
export function querySelectorAll(xpath: string, contextNode?: Node): Element[] {
    return evaluateXPath(xpath, { contextNode })
}

/**
 * 获取元素的 XPath 路径
 * @param element 目标元素
 * @returns 元素的 XPath 路径
 */
export function getElementXPath(element: Element): string {
    if (!element || !(element instanceof Element)) {
        throw new XPathError("Element must be a valid Element instance")
    }

    try {
        const path: string[] = []
        let current: Element | null = element

        while (current && current !== document.documentElement) {
            let index = 1
            let sibling = current.previousElementSibling

            // 计算同名兄弟元素中的位置
            while (sibling) {
                if (sibling.tagName === current.tagName) {
                    index++
                }
                sibling = sibling.previousElementSibling
            }

            const tagName = current.tagName.toLowerCase()
            const pathSegment = index > 1 ? `${tagName}[${index}]` : tagName
            path.unshift(pathSegment)

            current = current.parentElement
        }

        return `/${path.join("/")}`
    } catch (error) {
        throw new XPathError(
            `Failed to generate XPath: ${error instanceof Error ? error.message : "Unknown error"}`
        )
    }
}

/**
 * 验证 XPath 表达式的语法
 * @param xpath XPath 表达式
 * @returns 是否为有效的 XPath 表达式
 */
export function isValidXPath(xpath: string): boolean {
    if (!xpath || typeof xpath !== "string") {
        return false
    }

    try {
        document.evaluate(xpath, document, null, XPathResult.ANY_TYPE, null)
        return true
    } catch {
        return false
    }
}
