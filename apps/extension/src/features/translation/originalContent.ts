import type { TranslationNode } from "./DOMTraverser"

export const ORIGINAL_CONTENT_SELECTOR = "[data-mewcat-original]"

/** 只包装原始节点，保留节点身份和事件，避免隐藏同一容器中的译文。 */
export function hideOriginalContent(source: TranslationNode): HTMLElement[] {
    const wrappers: HTMLElement[] = []
    for (const { element } of source.textNodes ?? []) {
        const parent = element.parentNode
        if (
            !parent ||
            element.parentElement?.closest(ORIGINAL_CONTENT_SELECTOR)
        )
            continue
        const wrapper = element.ownerDocument.createElement("span")
        wrapper.setAttribute("data-mewcat-original", source.id)
        wrapper.setAttribute("aria-hidden", "true")
        wrapper.style.setProperty("display", "none", "important")
        parent.insertBefore(wrapper, element)
        wrapper.appendChild(element)
        wrappers.push(wrapper)
    }
    return wrappers
}

export function restoreOriginalContent(wrappers: HTMLElement[] = []): void {
    for (const wrapper of wrappers) {
        wrapper.replaceWith(...wrapper.childNodes)
    }
}

/** 遍历时把显示层包装视为透明，保持原有分段和节点 ID。 */
export function getOriginalParent(element: Node): HTMLElement | null {
    const parent = element.parentElement
    return parent?.matches(ORIGINAL_CONTENT_SELECTOR)
        ? parent.parentElement
        : parent
}
