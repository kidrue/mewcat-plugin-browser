import React from "react"

import { DailyActivity } from "./DailyActivity"
import { ActivityMetrics, ActivitySection, fmt, Metric, Muted } from "./styles"
import type { DeviceActivityOverviewProps } from "./types"

export const DeviceActivityOverview: React.FC<DeviceActivityOverviewProps> = ({
    data,
    loading,
    from
}) => {
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
