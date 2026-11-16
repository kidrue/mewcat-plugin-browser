import { useState } from "react"
import styled from "styled-components"

import {
    formatParagraphShortcut,
    shortcutFromEvent
} from "@/translation/paragraphShortcut"

const Controls = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    max-width: 100%;
    input {
        min-width: 80px;
        width: 140px;
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
const ErrorMessage = styled.p`
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--error);
`

export interface ShortcutInputProps {
    id: string
    label: string
    value: string
    defaultValue: string
    resetLabel: string
    disabled?: boolean
    allowClear?: boolean
    conflictingShortcut?: string
    conflictMessage?: string
    onChange: (value: string) => void
}

export default function ShortcutInput({
    id,
    label,
    value,
    defaultValue,
    resetLabel,
    disabled,
    allowClear,
    conflictingShortcut,
    conflictMessage,
    onChange
}: ShortcutInputProps) {
    const [recording, setRecording] = useState(false)
    const [error, setError] = useState("")
    const displayValue = value ? formatParagraphShortcut(value) : "已禁用"
    const save = (next: string) => {
        if (next && next === conflictingShortcut) {
            setError(conflictMessage ?? "此快捷键已被使用，请选择其他按键。")
            return
        }
        setError("")
        setRecording(false)
        onChange(next)
    }
    return (
        <>
            <Controls>
                <input
                    id={id}
                    aria-label={label}
                    aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
                    aria-invalid={Boolean(error)}
                    readOnly
                    disabled={disabled}
                    value={recording ? "请按快捷键…" : displayValue}
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
                        if (
                            event.repeat ||
                            event.nativeEvent.isComposing ||
                            event.nativeEvent.keyCode === 229
                        ) {
                            return
                        }
                        const shortcut = shortcutFromEvent(event.nativeEvent)
                        if (shortcut) {
                            save(shortcut)
                        }
                    }}
                />
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={resetLabel}
                    onClick={() => save(defaultValue)}
                >
                    恢复默认
                </button>
                {allowClear && (
                    <button
                        type="button"
                        disabled={disabled}
                        aria-label={`禁用${label}`}
                        onClick={() => save("")}
                    >
                        清除
                    </button>
                )}
            </Controls>
            {error && (
                <ErrorMessage id={`${id}-error`} role="alert">
                    {error}
                </ErrorMessage>
            )}
        </>
    )
}
