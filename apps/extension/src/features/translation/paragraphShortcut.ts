// cspell:words contenteditable
import { EDITABLE_SELECTOR, resolveParagraphTarget } from "./paragraphTarget"

export { EDITABLE_SELECTOR, EXTENSION_SELECTOR } from "./paragraphTarget"

export const DEFAULT_PARAGRAPH_SHORTCUT = "Alt+KeyQ"
const keyPattern =
    /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/
const modifiers = ["Ctrl", "Alt", "Shift", "Meta"]

export function isValidParagraphShortcut(value: string): boolean {
    const parts = value.split("+")
    const key = parts.pop()
    return Boolean(
        key &&
            keyPattern.test(key) &&
            parts.every(
                (part, index) =>
                    modifiers.includes(part) &&
                    (index === 0 ||
                        modifiers.indexOf(parts[index - 1]) <
                            modifiers.indexOf(part))
            )
    )
}
export function shortcutFromEvent(
    event: Pick<
        KeyboardEvent,
        "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
    >
): string | undefined {
    if (!keyPattern.test(event.code)) {
        return undefined
    }
    return [
        event.ctrlKey && "Ctrl",
        event.altKey && "Alt",
        event.shiftKey && "Shift",
        event.metaKey && "Meta",
        event.code
    ]
        .filter(Boolean)
        .join("+")
}
export function formatParagraphShortcut(value: string): string {
    return value
        .replace(/Key(?=[A-Z](?:$|\+))/g, "")
        .replace(/Digit(?=\d)/g, "")
        .replace("Space", "空格")
}
export function installParagraphShortcut(
    shortcut: string,
    onTranslate: (target: Element) => void,
    showPreview = false
): () => void {
    let pointer: { x: number; y: number } | undefined
    let preview: HTMLElement | undefined
    let label: HTMLElement | undefined
    const clearPreview = () => {
        preview?.remove()
        preview = undefined
        label = undefined
    }
    const move = (event: MouseEvent) => {
        pointer = { x: event.clientX, y: event.clientY }
        if (!showPreview) return
        const hit = document.elementFromPoint(pointer.x, pointer.y)
        const target = hit && resolveParagraphTarget(hit)
        if (!target || document.activeElement?.matches(EDITABLE_SELECTOR)) {
            clearPreview()
            return
        }
        const rect = target.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
            clearPreview()
            return
        }
        if (!preview) {
            preview = document.createElement("div")
            preview.setAttribute("data-mewcat-paragraph-preview", "")
            preview.setAttribute("aria-hidden", "true")
            preview.style.cssText =
                "all:initial;position:fixed;pointer-events:none;box-sizing:border-box;border:2px solid #38bdf8;border-radius:4px;background:rgba(56,189,248,0.06);z-index:2147483647;"
            label = document.createElement("span")
            label.textContent = `按 ${formatParagraphShortcut(shortcut)} 翻译此段`
            label.style.cssText =
                "position:absolute;left:0;top:0;transform:translateY(-100%);font:12px/1.5 sans-serif;color:#fff;background:#0369a1;padding:2px 6px;border-radius:4px;white-space:nowrap;pointer-events:none;"
            preview.attachShadow({ mode: "open" }).append(label)
            // 放到 body 外，避免提示层增删触发正文翻译观察器。
            document.documentElement.append(preview)
        }
        preview.style.left = `${rect.left}px`
        if (label)
            label.style.transform = rect.top < 30 ? "none" : "translateY(-100%)"
        preview.style.top = `${rect.top}px`
        preview.style.width = `${rect.width}px`
        preview.style.height = `${rect.height}px`
    }
    const reset = () => {
        pointer = undefined
        clearPreview()
    }
    const leave = (event: MouseEvent) => {
        if (!event.relatedTarget) {
            reset()
        }
    }
    const keydown = (event: KeyboardEvent) => {
        if (
            !pointer ||
            event.defaultPrevented ||
            event.repeat ||
            event.isComposing ||
            event.keyCode === 229 ||
            shortcutFromEvent(event) !== shortcut
        ) {
            return
        }
        if (
            document.activeElement?.matches(EDITABLE_SELECTOR) ||
            event
                .composedPath()
                .some(
                    node =>
                        node instanceof Element &&
                        (node.matches(EDITABLE_SELECTOR) ||
                            node.id === "translation-control-center-overlay")
                )
        ) {
            return
        }
        const hit = document.elementFromPoint(pointer.x, pointer.y)
        const target = hit && resolveParagraphTarget(hit)
        if (!target) {
            return
        }
        event.preventDefault()
        onTranslate(target)
    }
    document.addEventListener("mousemove", move, { passive: true })
    document.addEventListener("mouseout", leave)
    document.addEventListener("keydown", keydown)
    window.addEventListener("blur", reset)
    document.addEventListener("scroll", reset, true)
    window.addEventListener("scroll", reset)
    window.addEventListener("resize", reset)
    document.addEventListener("focusin", reset)
    return () => {
        document.removeEventListener("mousemove", move)
        document.removeEventListener("mouseout", leave)
        document.removeEventListener("keydown", keydown)
        window.removeEventListener("blur", reset)
        document.removeEventListener("scroll", reset, true)
        window.removeEventListener("scroll", reset)
        window.removeEventListener("resize", reset)
        document.removeEventListener("focusin", reset)
        reset()
    }
}
