// cspell:words contenteditable
export const EDITABLE_SELECTOR =
    'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'
export const EXTENSION_SELECTOR =
    "#translation-control-center-overlay,[data-translate-id],[data-mewcat-paragraph-preview],mewcat-selection-translate,mewcat-image-translate"
export const PARAGRAPH_CODE_SELECTOR = "code,pre,kbd,samp,tt,[role=code]"
export const PARAGRAPH_EXCLUDE_SELECTOR = `${EDITABLE_SELECTOR},${EXTENSION_SELECTOR},button,script,style,noscript,svg,math,iframe,canvas`

export function isParagraphBlock(element: Element): boolean {
    const display = getComputedStyle(element).display
    return (
        [
            "block",
            "flow-root",
            "flex",
            "grid",
            "list-item",
            "table-cell",
            "table-caption"
        ].includes(display) || display.startsWith("block ")
    )
}

/** 仅按布局选取最近容器；保护检查覆盖完整祖先链。 */
export function resolveParagraphTarget(target: Element): HTMLElement | null {
    if (
        !target.isConnected ||
        target.closest(
            `${PARAGRAPH_EXCLUDE_SELECTOR},${PARAGRAPH_CODE_SELECTOR}`
        )
    )
        return null
    let root: HTMLElement | null = null
    for (
        let element: Element | null = target;
        element && element !== document.documentElement;
        element = element.parentElement
    ) {
        const style = getComputedStyle(element)
        if (
            element.hasAttribute("hidden") ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0"
        )
            return null
        if (
            !root &&
            element !== document.body &&
            element instanceof HTMLElement &&
            isParagraphBlock(element)
        )
            root = element
    }
    if (!root) return null
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let text: Node | null
    while ((text = walker.nextNode())) {
        if (
            text.textContent?.trim() &&
            !text.parentElement?.closest(
                `${PARAGRAPH_EXCLUDE_SELECTOR},${PARAGRAPH_CODE_SELECTOR}`
            )
        )
            return root
    }
    return null
}
