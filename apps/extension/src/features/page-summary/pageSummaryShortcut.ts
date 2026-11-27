import { EDITABLE_SELECTOR } from "@/features/paragraph-translation"
import {
    isValidKeyboardShortcut,
    shortcutFromEvent
} from "@/utils/keyboardShortcut"

export function installPageSummaryShortcut(
    shortcut: string,
    onOpen: () => void
): () => void {
    if (!isValidKeyboardShortcut(shortcut)) {
        return () => undefined
    }
    const keydown = (event: KeyboardEvent) => {
        if (
            event.defaultPrevented ||
            event.repeat ||
            event.isComposing ||
            event.keyCode === 229 ||
            shortcutFromEvent(event) !== shortcut ||
            document.designMode === "on" ||
            document.activeElement?.closest(EDITABLE_SELECTOR) ||
            event
                .composedPath()
                .some(
                    node =>
                        node instanceof Element &&
                        node.closest(EDITABLE_SELECTOR)
                )
        ) {
            return
        }
        event.preventDefault()
        onOpen()
    }
    document.addEventListener("keydown", keydown)
    return () => document.removeEventListener("keydown", keydown)
}
