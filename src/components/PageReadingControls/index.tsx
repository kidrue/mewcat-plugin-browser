import { useCallback, useEffect, useRef, useState } from "react"
import styled from "styled-components"

import { AUTO_DETECT_OPTION, languages } from "@/constants"
import type {
    PageAction,
    PageActionExecutor,
    ReadingState
} from "@/reading/pageActions"

import NativeSelect from "../NativeSelect"

const Box = styled.section`
    display: grid;
    gap: 8px;
    padding: 12px;
    margin: 8px 0;
    border: 1px solid var(--border-color, #cfe0ef);
    border-radius: 12px;
    background: var(--bg-secondary, white);
    font-size: 13px;
    button {
        padding: 8px 12px;
        border: 1px solid #cfe0ef;
        border-radius: 8px;
        color: #245d91;
        background: #f0f7ff;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.6;
        cursor: default;
    }
    p {
        margin: 0;
    }
`
const labels = {
    idle: "尚未翻译",
    translating: "翻译中…",
    complete: "当前阅读区域已处理",
    partial: "部分内容翻译失败",
    unavailable: "当前页不可用"
}

export default function PageReadingControls({
    execute
}: {
    execute: PageActionExecutor
}) {
    const [state, setState] = useState<ReadingState>()
    const [pending, setPending] = useState(false)
    const revision = useRef(0)
    useEffect(() => {
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
    const active = state && !["idle", "unavailable"].includes(state.status)
    return (
        <Box aria-label="当前页翻译">
            <p role="status">
                {state ? labels[state.status] : "正在读取当前页…"}
            </p>
            {state?.reason && <p>{state.reason}</p>}
            {!!state && (state.translated > 0 || state.failed > 0) && (
                <p>
                    已翻译 {state.translated} 段
                    {state.failed ? `，失败 ${state.failed} 段` : ""}
                </p>
            )}
            <button
                disabled={unavailable || pending}
                onClick={() => void run(active ? "clear" : "start")}
            >
                {active ? "显示原文" : "翻译当前页"}
            </button>
            {!!state?.failed && (
                <button disabled={pending} onClick={() => void run("retry")}>
                    重试失败内容
                </button>
            )}
            <label>
                当前页源语言
                <NativeSelect
                    aria-label="当前页源语言"
                    disabled={unavailable || pending}
                    value={state?.sourceLanguage ?? "auto"}
                    options={[AUTO_DETECT_OPTION, ...languages.languages]}
                    onChange={value => void run("source", value)}
                />
            </label>
        </Box>
    )
}
