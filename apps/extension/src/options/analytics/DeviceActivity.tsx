import type { DeviceActivityAnalytics } from "@mewcat/client"
import React, { useState } from "react"
import styled from "styled-components"

import {
    Button,
    Card,
    fmt,
    localTime,
    Metric,
    Metrics,
    Mono,
    Muted,
    Row,
    TableScroll
} from "./styles"
import { useDeviceActivity } from "./useDeviceActivity"

type OverviewData = Extract<DeviceActivityAnalytics, { operation: "overview" }>

const ActivitySection = styled.section`
    display: grid;
    gap: var(--space-4);
    min-width: 0;
    container-type: inline-size;
    h3 {
        margin: 0;
    }
`
const ActivityMetrics = styled(Metrics)`
    grid-template-columns: repeat(3, minmax(0, 1fr));
    @container (max-width: 580px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    @container (max-width: 340px) {
        grid-template-columns: minmax(0, 1fr);
    }
`
const ChartBars = styled.div`
    display: flex;
    height: clamp(100px, 20vw, 180px);
    margin-top: var(--space-5);
    border-bottom: 1px solid var(--border-color);

    > div {
        display: flex;
        align-items: end;
        justify-content: center;
        flex: 1;
        min-width: 0;
    }

    span {
        width: 70%;
        border-radius: 2px 2px 0 0;
        background: var(--primary-color);
    }

    span:not(:only-child) {
        width: 42%;
    }

    span + span {
        background: var(--warning);
    }
`
const ChartAxis = styled.div`
    display: flex;
    justify-content: space-between;
    margin: var(--space-2) 0 var(--space-4);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
`
const ChartLegend = styled(Row)`
    margin-top: var(--space-4);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);

    span::before {
        display: inline-block;
        width: 0.7em;
        height: 0.7em;
        margin-inline-end: var(--space-2);
        border-radius: 2px;
        background: var(--primary-color);
        content: "";
    }

    span + span::before {
        background: var(--warning);
    }
`
const ProfileDates = styled.dl`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: var(--space-4);
    row-gap: var(--space-2);
    margin-bottom: 0;
    font-size: var(--font-size-sm);

    dt {
        color: var(--text-secondary);
    }

    dd {
        margin: 0;
        overflow-wrap: anywhere;
    }
`

const trends = [
    {
        label: "设备活跃",
        series: [
            { key: "activeDevices", label: "活跃设备" },
            { key: "firstTranslationDevices", label: "首次翻译设备" }
        ]
    },
    {
        label: "翻译页面",
        series: [{ key: "pages", label: "翻译页面" }]
    },
    {
        label: "安装与卸载",
        series: [
            { key: "installs", label: "新增安装" },
            { key: "uninstalls", label: "确认卸载" }
        ]
    }
] as const

const dailyColumns = [
    { key: "installs", label: "新增安装" },
    { key: "uninstalls", label: "确认卸载" },
    { key: "activeDevices", label: "活跃设备" },
    { key: "firstTranslationDevices", label: "首次翻译设备" },
    { key: "pages", label: "翻译页面" }
] as const

function DailyActivity({ days }: { days: OverviewData["days"] }) {
    const [trend, setTrend] = useState<(typeof trends)[number]>(trends[0])
    const max = Math.max(
        1,
        ...days.flatMap(day => trend.series.map(series => day[series.key]))
    )
    return (
        <Card $artwork="analyticsTrends">
            <Row>
                <h3>每日设备趋势</h3>
                {trends.map(item => (
                    <Button
                        key={item.label}
                        type="button"
                        aria-pressed={trend === item}
                        onClick={() => setTrend(item)}
                    >
                        {item.label}
                    </Button>
                ))}
            </Row>
            {days.length ? (
                <>
                    <ChartLegend>
                        {trend.series.map(series => (
                            <span key={series.key}>{series.label}</span>
                        ))}
                    </ChartLegend>
                    <ChartBars role="img" aria-label={`每日${trend.label}趋势`}>
                        {days.map(day => (
                            <div
                                key={day.day}
                                title={[
                                    day.day,
                                    ...trend.series.map(
                                        series =>
                                            `${series.label} ${fmt(day[series.key])}`
                                    )
                                ].join(" · ")}
                            >
                                {trend.series.map(series => (
                                    <span
                                        key={series.key}
                                        style={{
                                            height: `${(day[series.key] / max) * 100}%`
                                        }}
                                    />
                                ))}
                            </div>
                        ))}
                    </ChartBars>
                    <ChartAxis aria-hidden="true">
                        <span>{days[0].day}</span>
                        {days.length > 1 && <span>{days.at(-1)?.day}</span>}
                    </ChartAxis>
                    <details>
                        <summary>查看每日设备数据</summary>
                        <TableScroll>
                            <table>
                                <caption>UTC 每日设备统计</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">日期</th>
                                        {dailyColumns.map(column => (
                                            <th key={column.key} scope="col">
                                                {column.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {days.map(day => (
                                        <tr key={day.day}>
                                            <td>{day.day}</td>
                                            {dailyColumns.map(column => (
                                                <td key={column.key}>
                                                    <Mono>
                                                        {fmt(day[column.key])}
                                                    </Mono>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableScroll>
                    </details>
                </>
            ) : (
                <Muted>此区间暂无每日设备数据</Muted>
            )}
            <Muted>
                仅覆盖已授权设备的上报。每日页数按设备和页面去重，区间页数还会跨日去重。
            </Muted>
        </Card>
    )
}

export function DeviceActivityOverview({
    data,
    loading,
    from
}: {
    data: OverviewData | null
    loading: boolean
    from: string
}) {
    const firstDay = data?.days[0]?.day
    return (
        <ActivitySection aria-label="设备使用统计">
            <h3>设备使用统计</h3>
            {data && firstDay ? (
                <>
                    {firstDay > from && (
                        <Muted>
                            所选区间内仅从 {firstDay}（UTC）起有统计覆盖。
                        </Muted>
                    )}
                    <ActivityMetrics>
                        {(
                            [
                                [
                                    "新增安装",
                                    data.installs,
                                    "已授权上报的新安装"
                                ],
                                [
                                    "确认卸载",
                                    data.uninstalls,
                                    "已收到的卸载回调"
                                ],
                                [
                                    "活跃设备",
                                    data.activeDevices,
                                    "区间内翻译过页面的设备"
                                ],
                                [
                                    "首次翻译设备",
                                    data.firstTranslationDevices,
                                    "区间内首次成功翻译页面的设备"
                                ],
                                [
                                    "翻译页面",
                                    data.pages,
                                    "区间内按设备和页面去重"
                                ],
                                [
                                    "设备平均翻译页数",
                                    data.activeDevices
                                        ? data.pages / data.activeDevices
                                        : null,
                                    "翻译页数 ÷ 活跃设备数"
                                ]
                            ] as const
                        ).map(([label, value, note]) => (
                            <Metric key={label}>
                                <span>{label}</span>
                                <strong>{fmt(value)}</strong>
                                <small>{note}</small>
                            </Metric>
                        ))}
                    </ActivityMetrics>
                    <DailyActivity days={data.days} />
                </>
            ) : data ? (
                <Muted role="status">
                    所选区间超出设备使用统计的覆盖范围。
                </Muted>
            ) : (
                <Muted role="status">
                    {loading ? "正在读取设备使用统计…" : "设备使用统计暂不可用"}
                </Muted>
            )}
        </ActivitySection>
    )
}

export function DeviceActivityProfile({ clientId }: { clientId: string }) {
    const { data, loading, refresh } = useDeviceActivity({
        operation: "profile",
        clientId
    })
    const profile = data?.operation === "profile" ? data : null
    return (
        <Card $artwork="analyticsDevices" aria-label="设备使用统计">
            <h3>设备使用统计</h3>
            {profile ? (
                <>
                    <Metrics>
                        <Metric>
                            近 7 天翻译页面
                            <strong>{fmt(profile.pagesLast7)}</strong>
                        </Metric>
                        <Metric>
                            近 30 天翻译页面
                            <strong>{fmt(profile.pagesLast30)}</strong>
                        </Metric>
                    </Metrics>
                    <ProfileDates>
                        <dt>安装时间</dt>
                        <dd>
                            {profile.installedAt
                                ? localTime(profile.installedAt)
                                : "未观察到"}
                        </dd>
                        <dt>已确认卸载时间</dt>
                        <dd>
                            {profile.uninstalledAt
                                ? localTime(profile.uninstalledAt)
                                : "未收到回调"}
                        </dd>
                        <dt>最近翻译时间</dt>
                        <dd>
                            {profile.lastTranslationAt
                                ? localTime(profile.lastTranslationAt)
                                : "未观察到"}
                        </dd>
                    </ProfileDates>
                    <Muted>仅统计设备授权且仍在留存期内的活动。</Muted>
                </>
            ) : (
                <Row>
                    <Muted role="status">
                        {loading
                            ? "正在读取设备使用统计…"
                            : "设备使用统计暂不可用"}
                    </Muted>
                    {!loading && (
                        <Button type="button" onClick={refresh}>
                            重试
                        </Button>
                    )}
                </Row>
            )}
        </Card>
    )
}
