import React, { useState } from "react"

import { OptionsCardGrid } from "@/components/OptionsPageLayout"

import { AnalysisStatus } from "./AnalysisStatus"
import { Languages } from "./Languages"
import {
    Button,
    Card,
    fmt,
    Metric,
    Metrics,
    Mono,
    Muted,
    percent,
    relative,
    Row,
    TableScroll
} from "./styles"
import type { OverviewProps } from "./types"

export const Overview: React.FC<OverviewProps> = ({ data }) => {
    const [measure, setMeasure] = useState<"requests" | "characters">(
        "requests"
    )
    const max = data.days.reduce(
        (value, day) =>
            BigInt(day[measure]) > value ? BigInt(day[measure]) : value,
        BigInt(0)
    )
    return (
        <>
            <Metrics>
                {[
                    [
                        "翻译与生成调用",
                        fmt(data.totals.requests),
                        "自有翻译与对话接口"
                    ],
                    [
                        "成功率",
                        percent(data.totals.successRate),
                        `成功 ${fmt(data.totals.successes)} · 失败 ${fmt(data.totals.failures)}`
                    ],
                    [
                        "翻译字符",
                        fmt(data.totals.characters),
                        "已预占的输入字符"
                    ],
                    [
                        "活跃翻译设备",
                        fmt(data.activeDevices),
                        "按已验证设备去重"
                    ]
                ].map(([label, value, note]) => (
                    <Metric key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                        <small>{note}</small>
                    </Metric>
                ))}
            </Metrics>
            <OptionsCardGrid>
                <Card $artwork="analyticsTrends">
                    <Row>
                        <h3>每日趋势</h3>
                        <Button
                            type="button"
                            aria-pressed={measure === "requests"}
                            onClick={() => setMeasure("requests")}
                        >
                            调用
                        </Button>
                        <Button
                            type="button"
                            aria-pressed={measure === "characters"}
                            onClick={() => setMeasure("characters")}
                        >
                            字符
                        </Button>
                    </Row>
                    <Muted>
                        UTC 日界 · 对应北京时间
                        08:00，仅补齐已知覆盖范围内的空日期。
                    </Muted>
                    {data.days.length ? (
                        <>
                            <svg
                                viewBox="0 0 640 230"
                                role="img"
                                aria-label={`每日翻译${measure === "requests" ? "调用" : "字符"}趋势`}
                                style={{
                                    width: "100%",
                                    height: "auto",
                                    marginTop: 16
                                }}
                            >
                                <title>
                                    每日翻译
                                    {measure === "requests" ? "调用" : "字符"}
                                    趋势，精确值见下方数据表
                                </title>
                                <line
                                    x1="16"
                                    y1="194"
                                    x2="624"
                                    y2="194"
                                    stroke="var(--border-color)"
                                />
                                {data.days.map((day, index) => {
                                    const width = 600 / data.days.length,
                                        height =
                                            relative(day[measure], max) * 1.7
                                    return (
                                        <g key={day.day}>
                                            <rect
                                                x={20 + index * width}
                                                y={194 - height}
                                                width={Math.max(2, width * 0.7)}
                                                height={height}
                                                rx="3"
                                                fill="var(--primary-color)"
                                            >
                                                <title>
                                                    {day.day}：
                                                    {fmt(day[measure])}
                                                </title>
                                            </rect>
                                            {(data.days.length <= 7 ||
                                                index %
                                                    Math.ceil(
                                                        data.days.length / 6
                                                    ) ===
                                                    0) && (
                                                <text
                                                    x={20 + index * width}
                                                    y="218"
                                                    fontSize="12"
                                                    fill="var(--text-secondary)"
                                                >
                                                    {day.day.slice(5)}
                                                </text>
                                            )}
                                        </g>
                                    )
                                })}
                            </svg>
                            <details>
                                <summary>查看精确数据</summary>
                                <TableScroll>
                                    <table>
                                        <caption>UTC 每日统计</caption>
                                        <thead>
                                            <tr>
                                                <th>日期</th>
                                                <th>翻译调用</th>
                                                <th>翻译字符</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.days.map(day => (
                                                <tr key={day.day}>
                                                    <td>{day.day}</td>
                                                    <td>
                                                        <Mono>
                                                            {fmt(day.requests)}
                                                        </Mono>
                                                    </td>
                                                    <td>
                                                        <Mono>
                                                            {fmt(
                                                                day.characters
                                                            )}
                                                        </Mono>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </TableScroll>
                            </details>
                        </>
                    ) : (
                        <Muted>此区间暂无已采集的趋势数据</Muted>
                    )}
                </Card>
                <Card $artwork="analyticsLanguages">
                    <h3>常用语言</h3>
                    <Languages items={data.languages} />
                    <Muted>仅已执行的翻译具有语言信息，展示前 20 项。</Muted>
                </Card>
            </OptionsCardGrid>
            <OptionsCardGrid>
                <Card $artwork="analyticsServices">
                    <h3>服务表现</h3>
                    <TableScroll>
                        <table>
                            <tbody>
                                <tr>
                                    <th>平均耗时</th>
                                    <td>
                                        <Mono>
                                            {fmt(data.totals.averageDurationMs)}{" "}
                                            ms
                                        </Mono>
                                    </td>
                                </tr>
                                <tr>
                                    <th>p95 耗时</th>
                                    <td>
                                        <Mono>
                                            {fmt(data.p95DurationMs)} ms
                                        </Mono>
                                    </td>
                                </tr>
                                <tr>
                                    <th>已知输入 / 输出 token</th>
                                    <td>
                                        <Mono>
                                            {fmt(data.totals.promptTokens)} /{" "}
                                            {fmt(data.totals.completionTokens)}
                                        </Mono>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </TableScroll>
                    <Muted>
                        token 仅汇总供应商报告值，未知用量不计为精确零费用。
                        {data.p95UnavailableReason &&
                            `p95 暂不可用：${data.p95UnavailableReason}`}
                    </Muted>
                    <h4 style={{ marginTop: 20 }}>翻译错误分布</h4>
                    {data.errors.length ? (
                        data.errors.map(error => (
                            <Muted key={error.code}>
                                <Mono>{error.code}</Mono> ·{" "}
                                {fmt(error.requests)} 次
                            </Muted>
                        ))
                    ) : (
                        <Muted>保留的调用明细中暂无翻译错误</Muted>
                    )}
                </Card>
                <Card $artwork="analyticsDevices">
                    <AnalysisStatus data={data.analysis} />
                </Card>
            </OptionsCardGrid>
        </>
    )
}
