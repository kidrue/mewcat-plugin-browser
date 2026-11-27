import type React from "react"
import { useCallback, useLayoutEffect, useRef, useState } from "react"

import { ActionIcon } from "./ActionIcon"
import { ActionButton, Actions, Notice } from "./styles"
import type { SelectionToolbarProps } from "./types"

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
    result,
    active,
    pinned,
    onTogglePinned,
    onClose
}) => {
    const [notice, setNotice] = useState("")
    const [copying, setCopying] = useState(false)

    const version = useRef(0)
    const noticeTimer = useRef<ReturnType<typeof setTimeout>>()

    const advanceVersion = useCallback(() => ++version.current, [])

    useLayoutEffect(() => {
        advanceVersion()
        setNotice("")
        setCopying(false)
        return () => {
            advanceVersion()
            clearTimeout(noticeTimer.current)
        }
    }, [result, active, advanceVersion])

    const copy = useCallback(async () => {
        const currentVersion = ++version.current
        clearTimeout(noticeTimer.current)
        setCopying(true)
        setNotice("")
        try {
            const content =
                result.mode === "explain" && result.explanation
                    ? `译文：${result.value}\n\n术语解释：${result.explanation}`
                    : result.value
            await navigator.clipboard.writeText(content)
            if (currentVersion !== version.current) {
                return
            }
            setNotice("已复制")
            noticeTimer.current = setTimeout(() => setNotice(""), 1800)
        } catch {
            if (currentVersion === version.current) {
                setNotice("复制失败，请选中内容手动复制")
            }
        } finally {
            if (currentVersion === version.current) {
                setCopying(false)
            }
        }
    }, [result.explanation, result.mode, result.value])
    const copyLabel = notice === "已复制" ? "已复制" : "复制结果"
    const pinLabel = pinned ? "取消固定" : "固定面板"

    return (
        <Actions role="group" aria-label="划词面板操作">
            <ActionButton
                type="button"
                title={copyLabel}
                aria-label={copyLabel}
                disabled={
                    !active ||
                    result.loading ||
                    !result.value ||
                    !!result.error ||
                    copying
                }
                onClick={() => void copy()}
            >
                <ActionIcon name={notice === "已复制" ? "check" : "copy"} />
            </ActionButton>
            <ActionButton
                type="button"
                title={pinLabel}
                aria-label={pinLabel}
                aria-pressed={pinned}
                onClick={onTogglePinned}
            >
                <ActionIcon name="pin" />
            </ActionButton>
            <ActionButton
                type="button"
                title="关闭划词面板"
                aria-label="关闭划词面板"
                onClick={onClose}
            >
                <ActionIcon name="close" />
            </ActionButton>
            {notice && <Notice role="status">{notice}</Notice>}
        </Actions>
    )
}
