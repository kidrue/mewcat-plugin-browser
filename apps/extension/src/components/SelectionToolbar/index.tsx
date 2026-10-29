import { useLayoutEffect, useRef, useState } from "react"
import styled from "styled-components"

import type { SelectionResult } from "@/hooks/useSelectionTranslation"

interface SelectionToolbarProps {
    result: SelectionResult
    active: boolean
    pinned: boolean
    onTogglePinned: () => void
    onClose: () => void
}

const Actions = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
`

const ActionButton = styled.button`
    width: 30px;
    height: 30px;
    padding: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-md, 8px);
    background: transparent;
    color: #6f879c;
    cursor: pointer;
    transition:
        color 0.16s ease,
        background 0.16s ease;

    &:hover:not(:disabled),
    &[aria-pressed="true"] {
        color: #2878c8;
        background: #eaf4fd;
    }
    &:focus-visible {
        outline: 2px solid #2878c8;
        outline-offset: 2px;
    }
    &:disabled {
        opacity: 0.4;
        cursor: default;
    }
    svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
    }
`

const Notice = styled.span`
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 1;
    width: max-content;
    max-width: 210px;
    padding: 6px 9px;
    border-radius: var(--radius-md, 8px);
    background: #eef7ff;
    color: #203b57;
    font-size: 11px;
    line-height: 1.6;
    box-shadow: 0 3px 12px rgba(32, 59, 87, 0.12);
    pointer-events: none;
`

function ActionIcon({ name }: { name: "copy" | "check" | "pin" | "close" }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {name === "copy" && (
                <>
                    <rect x="8" y="8" width="12" height="13" rx="2" />
                    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                </>
            )}
            {name === "check" && <path d="m5 12 4 4L19 6" />}
            {name === "pin" && (
                <path d="M16 9V4l1-1H7l1 1v5l-2 3v2h12v-2l-2-3ZM12 14v7" />
            )}
            {name === "close" && <path d="m6 6 12 12M6 18 18 6" />}
        </svg>
    )
}

export default function SelectionToolbar({
    result,
    active,
    pinned,
    onTogglePinned,
    onClose
}: SelectionToolbarProps) {
    const [notice, setNotice] = useState("")
    const [copying, setCopying] = useState(false)
    const version = useRef(0)
    const noticeTimer = useRef<ReturnType<typeof setTimeout>>()

    useLayoutEffect(() => {
        version.current++
        setNotice("")
        setCopying(false)
        return () => {
            version.current++
            clearTimeout(noticeTimer.current)
        }
    }, [result, active])

    const copy = async () => {
        const currentVersion = ++version.current
        clearTimeout(noticeTimer.current)
        setCopying(true)
        setNotice("")
        try {
            await navigator.clipboard.writeText(result.value)
            if (currentVersion !== version.current) return
            setNotice("已复制")
            noticeTimer.current = setTimeout(() => setNotice(""), 1800)
        } catch {
            if (currentVersion === version.current)
                setNotice("复制失败，请选中内容手动复制")
        } finally {
            if (currentVersion === version.current) setCopying(false)
        }
    }
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
