import { DEFAULT_PARAGRAPH_SHORTCUT } from "@/translation/paragraphShortcut"

import ShortcutInput from "../ShortcutInput"

export default function ParagraphShortcutInput(props: {
    value: string
    disabled?: boolean
    conflictingShortcut?: string
    onChange: (value: string) => void
}) {
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
