import { useCallback, useEffect, useRef, useState } from "react"

import type {
    PageAction,
    PageActionExecutor,
    ReadingState
} from "@/reading/pageActions"

export const readingStatusLabels = {
    idle: "尚未翻译",
    translating: "翻译中…",
    complete: "当前阅读区域已处理",
    partial: "部分内容翻译失败",
    unavailable: "当前页不可用"
}

export function usePageReadingControls(execute?: PageActionExecutor) {
    const [state, setState] = useState<ReadingState>()
    const [pending, setPending] = useState(false)
    const revision = useRef(0)
    useEffect(() => {
        if (!execute) return
        let active = true
        let timer: ReturnType<typeof setTimeout>
        const poll = async () => {
            const version = revision.current
            try {
                const next = await execute({
                    type: "MEWCAT_PAGE_ACTION",
                    action: "status"
                })
                if (active && version === revision.current) setState(next)
            } catch {
                if (active && version === revision.current)
                    setState({
                        status: "unavailable",
                        translated: 0,
                        failed: 0,
                        reason: "无法连接当前页，请刷新后重试。"
                    })
            } finally {
                if (active) timer = setTimeout(() => void poll(), 1000)
            }
        }
        void poll()
        return () => {
            active = false
            revision.current++
            clearTimeout(timer)
        }
    }, [execute])
    const run = useCallback(
        async (action: PageAction, sourceLanguage?: string) => {
            if (!execute) return
            const version = ++revision.current
            setPending(true)
            try {
                const next = await execute({
                    type: "MEWCAT_PAGE_ACTION",
                    action,
                    sourceLanguage
                })
                if (version === revision.current) setState(next)
            } catch {
                if (version === revision.current)
                    setState({
                        status: "unavailable",
                        translated: 0,
                        failed: 0,
                        reason: "操作失败，请重试。"
                    })
            } finally {
                if (version === revision.current) setPending(false)
            }
        },
        [execute]
    )
    const unavailable = !state || state.status === "unavailable"
    const active = Boolean(
        state && !["idle", "unavailable"].includes(state.status)
    )
    return { state, pending, run, unavailable, active }
}
