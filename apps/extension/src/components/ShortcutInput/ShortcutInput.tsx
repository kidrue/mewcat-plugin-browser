import type React from "react"
import { useCallback, useState } from "react"

import {
    formatParagraphShortcut,
    shortcutFromEvent
} from "@/features/translation/paragraphShortcut"

import { Controls, ErrorMessage } from "./styles"
import type { ShortcutInputProps } from "./types"

export const ShortcutInput: React.FC<ShortcutInputProps> = ({
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
}) => {
    const [recording, setRecording] = useState(false)
    const [error, setError] = useState("")
    const displayValue = value ? formatParagraphShortcut(value) : "已禁用"
    const save = useCallback(
        (next: string) => {
            if (next && next === conflictingShortcut) {
                setError(
                    conflictMessage ?? "此快捷键已被使用，请选择其他按键。"
                )
                return
            }
            setError("")
            setRecording(false)
            onChange(next)
        },
        [conflictMessage, conflictingShortcut, onChange]
    )
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
