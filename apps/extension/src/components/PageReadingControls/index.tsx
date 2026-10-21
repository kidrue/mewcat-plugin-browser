import styled from "styled-components"

import { AUTO_DETECT_OPTION, languages } from "@/constants"
import {
    readingStatusLabels as labels,
    usePageReadingControls
} from "@/hooks/usePageReadingControls"
import type { PageActionExecutor } from "@/reading/pageActions"

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

export default function PageReadingControls({
    execute
}: {
    execute: PageActionExecutor
}) {
    const { state, pending, run, unavailable, active } =
        usePageReadingControls(execute)
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
