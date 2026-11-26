import type React from "react"

import { AUTO_DETECT_OPTION, languages } from "@/constants"
import {
    readingStatusLabels as labels,
    usePageReadingControls
} from "@/hooks/usePageReadingControls"

import NativeSelect from "../NativeSelect"
import { Box } from "./styles"
import type { PageReadingControlsProps } from "./types"

export const PageReadingControls: React.FC<PageReadingControlsProps> = ({
    execute
}) => {
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
