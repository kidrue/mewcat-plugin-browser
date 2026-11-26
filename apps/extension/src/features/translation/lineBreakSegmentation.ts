import { nanoid } from "nanoid"

import type { TextNode, TranslationNode } from "./DOMTraverser"
import { ORIGINAL_CONTENT_SELECTOR } from "./originalContent"

// 重扫和显示模式切换继续使用真实源节点的身份，不把段 ID 写到共享父容器上。
const segmentIds = new WeakMap<Node, string>()

/** 只拆分已接受的内容；克隆片段仅用于生成翻译输入，原始 DOM 不变。 */
export function splitTranslationNodeAtBreaks(
    source: TranslationNode,
    readNode: (element: HTMLElement) => TextNode | null
): TranslationNode[] {
    if (
        !source.textNodes?.some(
            node =>
                node.type === "text" &&
                (node.element.nodeName === "BR" ||
                    node.element.querySelector?.("br"))
        )
    )
        return [source]

    const groups: TextNode[][] = []
    let current: TextNode[] = []
    let hasBreak = false
    const hasContent = (nodes: TextNode[]) =>
        nodes.some(
            node => node.content.trim() && node.element.nodeName !== "BR"
        )

    const visit = (node: TextNode, ancestors: HTMLElement[] = []) => {
        const element = node.element
        if (node.type === "text" && element.nodeName === "BR") {
            hasBreak = true
            current.push(node)
            if (hasContent(current)) groups.push(current)
            else if (groups.length) groups.at(-1)!.push(...current)
            current = []
            return
        }

        if (node.type === "text" && element.querySelector?.("br")) {
            const visitChild = (child: Node) => {
                if (
                    child.nodeType === Node.ELEMENT_NODE &&
                    (child as Element).matches(ORIGINAL_CONTENT_SELECTOR)
                ) {
                    child.childNodes.forEach(visitChild)
                    return
                }
                const text = readNode(child as HTMLElement)
                if (text) visit(text, [...ancestors, element])
            }
            element.childNodes.forEach(visitChild)
            return
        }

        if (ancestors.length && node.type === "text") {
            let fragment = element.cloneNode(true)
            for (const ancestor of [...ancestors].reverse()) {
                const wrapper = ancestor.cloneNode(false)
                wrapper.appendChild(fragment)
                fragment = wrapper
            }
            current.push({ ...node, translationElement: fragment })
        } else current.push(node)
    }

    for (const node of source.textNodes) visit(node)
    // 原始 BR 被页面删除后，仍保留过滤结果，避免把链接里的旧译文再次提取。
    if (!hasBreak) return [{ ...source, textNodes: current }]
    if (hasContent(current)) groups.push(current)

    return groups
        .filter(textNodes =>
            textNodes.some(
                node =>
                    node.type === "text" &&
                    node.content.trim() &&
                    node.element.nodeName !== "BR"
            )
        )
        .map(textNodes => {
            const segmentAnchor = textNodes.find(
                node => node.content.trim() && node.element.nodeName !== "BR"
            )!.element
            let id = segmentIds.get(segmentAnchor)
            if (!id) {
                id = nanoid()
                segmentIds.set(segmentAnchor, id)
            }
            return {
                ...source,
                id,
                segmentAnchor,
                textNodes,
                insertTagType: "br"
            }
        })
}
