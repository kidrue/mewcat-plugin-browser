const keyPattern =
    /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/
const modifiers = ["Ctrl", "Alt", "Shift", "Meta"]

export function isValidKeyboardShortcut(value: string): boolean {
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
export function formatKeyboardShortcut(value: string): string {
    return value
        .replace(/Key(?=[A-Z](?:$|\+))/g, "")
        .replace(/Digit(?=\d)/g, "")
        .replace("Space", "空格")
}
