import React, { useState } from "react"

import { dailyColumns, trends } from "./constants"
import {
    Button,
    Card,
    ChartAxis,
    ChartBars,
    ChartLegend,
    fmt,
    Mono,
    Muted,
    Row,
    TableScroll
} from "./styles"
import type { DailyActivityProps } from "./types"

export const DailyActivity: React.FC<DailyActivityProps> = ({ days }) => {
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
