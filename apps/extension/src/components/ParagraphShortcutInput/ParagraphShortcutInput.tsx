import type React from "react"

import { DEFAULT_PARAGRAPH_SHORTCUT } from "@/features/translation/paragraphShortcut"

import ShortcutInput from "../ShortcutInput"
import type { ParagraphShortcutInputProps } from "./types"

export const ParagraphShortcutInput: React.FC<
    ParagraphShortcutInputProps
> = props => {
    return (
        <ShortcutInput
            {...props}
            id="paragraph-translation-shortcut"
            label="段落翻译快捷键"
            defaultValue={DEFAULT_PARAGRAPH_SHORTCUT}
            resetLabel="恢复段落翻译默认快捷键"
            conflictMessage="此快捷键已用于页面总结，请选择其他按键。"
        />
    )
}
