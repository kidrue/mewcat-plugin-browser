import { useState } from "react"
import styled from "styled-components"

import {
    DEFAULT_PARAGRAPH_SHORTCUT,
    formatParagraphShortcut,
    shortcutFromEvent
} from "@/translation/paragraphShortcut"

const Controls = styled.div`
    display: flex;
    gap: var(--space-2);
    align-items: center;
    input {
        min-width: 0;
        flex: 1;
    }
    input,
    button {
        height: 36px;
        padding: 0 var(--space-3);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        font: inherit;
        color: var(--text-primary);
        background: var(--bg-secondary);
    }
    input:focus-visible,
    button:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
    button {
        cursor: pointer;
        white-space: nowrap;
    }
    :disabled {
        opacity: 0.5;
        cursor: default;
    }
`
export default function ParagraphShortcutInput({
    value,
    disabled,
    onChange
}: {
    value: string
    disabled?: boolean
    onChange: (value: string) => void
}) {
    const [recording, setRecording] = useState(false)
    return (
        <Controls>
            <input
                id="paragraph-translation-shortcut"
                aria-label="段落翻译快捷键"
                aria-describedby="paragraph-translation-shortcut-description"
                readOnly
                disabled={disabled}
                value={
                    recording ? "请按快捷键…" : formatParagraphShortcut(value)
                }
                onFocus={() => setRecording(true)}
                onBlur={() => setRecording(false)}
                onKeyDown={event => {
                    if (event.key === "Tab") {
                        return
                    }
                    event.preventDefault()
                    event.stopPropagation()
                    if (event.key === "Escape") {
                        event.currentTarget.blur()
                        return
                    }
                    if (event.repeat || event.nativeEvent.isComposing) {
                        return
                    }
                    const shortcut = shortcutFromEvent(event.nativeEvent)
                    if (shortcut) {
                        onChange(shortcut)
                        setRecording(false)
                    }
                }}
            />
            <button
                type="button"
                disabled={disabled}
                aria-label="恢复段落翻译默认快捷键"
                onClick={() => onChange(DEFAULT_PARAGRAPH_SHORTCUT)}
            >
                恢复默认
            </button>
        </Controls>
    )
}
