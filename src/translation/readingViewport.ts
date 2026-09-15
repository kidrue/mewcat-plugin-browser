import type { TranslationNode } from "./DOMTraverser"

export type ReadingRoot = HTMLElement | null
export interface ReadingPosition {
    visible: boolean
    side: -1 | 0 | 1
    distance: number
    root: ReadingRoot
}

const scrollable = /^(auto|scroll|overlay)$/
const clipped = /^(auto|scroll|overlay|hidden|clip)$/

export function getReadingRoot(element: HTMLElement): ReadingRoot {
    for (
        let parent = element.parentElement;
        parent &&
        parent !== document.body &&
        parent !== document.documentElement;
        parent = parent.parentElement
    ) {
        const style = getComputedStyle(parent)
        if (
            scrollable.test(style.overflowY || style.overflow) &&
            parent.scrollHeight > parent.clientHeight
        ) {
            return parent
        }
    }
    return null
}

export function readingHeight(root: ReadingRoot): number {
    return Math.max(1, root ? root.clientHeight : window.innerHeight)
}

// Use source ranges so inserted translations and large shared parent elements
// cannot make distant source text appear to be in the reading area.
function sourceRect(node: TranslationNode): DOMRect {
    const rects: DOMRect[] = []
    for (const text of node.textNodes ?? []) {
        if (!text.element.isConnected) continue
        const range = document.createRange()
        range.selectNode(text.element)
        if (typeof range.getBoundingClientRect === "function") {
            const rect = range.getBoundingClientRect()
            if (rect.width && rect.height) rects.push(rect)
        }
    }
    if (!rects.length) return node.container.getBoundingClientRect()
    const left = Math.min(...rects.map(rect => rect.left))
    const top = Math.min(...rects.map(rect => rect.top))
    return new DOMRect(
        left,
        top,
        Math.max(...rects.map(rect => rect.right)) - left,
        Math.max(...rects.map(rect => rect.bottom)) - top
    )
}

export function getReadingPosition(
    node: TranslationNode
): ReadingPosition | null {
    if (!node.container.isConnected) return null
    const rect = sourceRect(node)
    if (rect.width <= 0 || rect.height <= 0) return null
    let top = 0
    let bottom = window.innerHeight
    let left = 0
    let right = window.innerWidth
    let rangeTop = -window.innerHeight
    let rangeBottom = window.innerHeight * 2
    const root = getReadingRoot(node.container)

    for (
        let element: HTMLElement | null = node.container;
        element;
        element = element.parentElement
    ) {
        const style = getComputedStyle(element)
        if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.visibility === "collapse" ||
            style.contentVisibility === "hidden"
        )
            return null
        if (
            element === node.container ||
            element === document.body ||
            element === document.documentElement
        )
            continue
        const clipY = clipped.test(style.overflowY || style.overflow)
        const clipX = clipped.test(style.overflowX || style.overflow)
        if (!clipX && !clipY) continue
        const bounds = element.getBoundingClientRect()
        const portTop = bounds.top + element.clientTop
        const portBottom = portTop + element.clientHeight
        const portLeft = bounds.left + element.clientLeft
        const portRight = portLeft + element.clientWidth
        if (clipY) {
            // A distant/offscreen scroll container must not expose its children
            // just because their coordinates before clipping overlap us.
            if (portBottom <= rangeTop || portTop >= rangeBottom) return null
            const margin = scrollable.test(style.overflowY || style.overflow)
                ? element.clientHeight
                : 0
            rangeTop = Math.max(rangeTop, portTop - margin)
            rangeBottom = Math.min(rangeBottom, portBottom + margin)
            top = Math.max(top, portTop)
            bottom = Math.min(bottom, portBottom)
        }
        if (clipX) {
            left = Math.max(left, portLeft)
            right = Math.min(right, portRight)
        }
    }
    if (
        rangeBottom <= rangeTop ||
        right <= left ||
        rect.bottom <= rangeTop ||
        rect.top >= rangeBottom ||
        rect.right <= left ||
        rect.left >= right
    )
        return null
    const visible = bottom > top && rect.bottom > top && rect.top < bottom
    const side = visible ? 0 : rect.bottom <= top ? -1 : 1
    return {
        visible,
        side,
        distance: visible
            ? 0
            : Math.max(0, side < 0 ? top - rect.bottom : rect.top - bottom),
        root
    }
}

export function compareReadingDOM(
    a: TranslationNode,
    b: TranslationNode
): number {
    const position = a.container.compareDocumentPosition(b.container)
    if (position & Node.DOCUMENT_POSITION_DISCONNECTED) return 0
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
    return 0
}
