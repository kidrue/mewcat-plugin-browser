import React from "react"

import { fmt, Muted, percent } from "./styles"
import type { AnalysisStatusProps } from "./types"

export const AnalysisStatus: React.FC<AnalysisStatusProps> = ({ data }) => {
    return (
        <>
            <h3>内容分析</h3>
            <p>
                {!data.captureContent
                    ? "内容采集未启用"
                    : !data.autoAnalyze
                      ? "自动分析未启用"
                      : "内容分析已启用"}
            </p>
            <Muted>
                {!data.captureContent
                    ? "行为与调用统计仍正常展示，启用内容采集后才能生成主题与关键词。"
                    : `已完成 ${fmt(data.completed)} 个分析样本，覆盖率 ${percent(data.coverage)}。`}
            </Muted>
            {data.jobs.length > 0 && (
                <Muted>
                    {data.jobs
                        .map(job => `${job.status}：${fmt(job.count)}`)
                        .join(" · ")}
                </Muted>
            )}
        </>
    )
}
