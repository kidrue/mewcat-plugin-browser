// cspell:words contenteditable
export const DEFAULT_PARAGRAPH_SHORTCUT = "Alt+KeyQ"
const keyPattern =
    /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/
const modifiers = ["Ctrl", "Alt", "Shift", "Meta"]
export const EDITABLE_SELECTOR =
    'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'
export const EXTENSION_SELECTOR =
    "#translation-control-center-overlay,[data-translate-id],mewcat-selection-translate,mewcat-image-translate"

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
    onTranslate: (target: Element) => void
): () => void {
    let pointer: { x: number; y: number } | undefined
    const move = (event: MouseEvent) => {
        pointer = { x: event.clientX, y: event.clientY }
    }
    const reset = () => {
        pointer = undefined
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
        const target = document.elementFromPoint(pointer.x, pointer.y)
        if (
            !target ||
            target.closest(`${EDITABLE_SELECTOR},${EXTENSION_SELECTOR},button`)
        ) {
            return
        }
        event.preventDefault()
        onTranslate(target)
    }
    document.addEventListener("mousemove", move, { passive: true })
    document.addEventListener("mouseout", leave)
    document.addEventListener("keydown", keydown)
    window.addEventListener("blur", reset)
    return () => {
        document.removeEventListener("mousemove", move)
        document.removeEventListener("mouseout", leave)
        document.removeEventListener("keydown", keydown)
        window.removeEventListener("blur", reset)
    }
}
