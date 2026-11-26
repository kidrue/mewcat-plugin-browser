import React from "react"

import { useDeviceActivity } from "@/hooks/useDeviceActivity"

import {
    Button,
    Card,
    fmt,
    localTime,
    Metric,
    Metrics,
    Muted,
    ProfileDates,
    Row
} from "./styles"
import type { DeviceActivityProfileProps } from "./types"

export const DeviceActivityProfile: React.FC<DeviceActivityProfileProps> = ({
    clientId
}) => {
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
