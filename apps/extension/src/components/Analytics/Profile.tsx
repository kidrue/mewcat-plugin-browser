import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { useAnalyticsRequest } from "@/hooks/useAnalyticsRequest"

import { AnalysisStatus } from "./AnalysisStatus"
import { copyDeviceId } from "./clipboard"
import { DeviceActivityProfile } from "./DeviceActivityProfile"
import { DeviceId } from "./DeviceId"
import { Languages } from "./Languages"
import {
    Alert,
    Button,
    Card,
    Dialog,
    fmt,
    localTime,
    Metric,
    Metrics,
    Muted,
    percent,
    Row
} from "./styles"
import type { ProfileProps } from "./types"

export const Profile: React.FC<ProfileProps> = ({
    clientId,
    onClose,
    onCalls
}) => {
    const dialog = useRef<HTMLDialogElement>(null)

    const { data, error, loading, refresh } = useAnalyticsRequest({
        operation: "profile",
        clientId
    })

    const [copied, setCopied] = useState("")

    useEffect(() => {
        const element = dialog.current!
        element.showModal()
        return () => {
            element.close()
        }
    }, [])
    const profile = data?.operation === "profile" ? data : null
    return createPortal(
        <Dialog
            ref={dialog}
            aria-labelledby="analytics-profile-title"
            onCancel={onClose}
            onClick={event => {
                if (event.target === event.currentTarget) {
                    const bounds = event.currentTarget.getBoundingClientRect()
                    if (
                        event.clientX < bounds.left ||
                        event.clientX > bounds.right
                    ) {
                        onClose()
                    }
                }
            }}
        >
            <Row style={{ justifyContent: "space-between" }}>
                <div>
                    <Muted>固定近 30 天画像 · 不随列表日期变化</Muted>
                    <h2 id="analytics-profile-title">设备详情</h2>
                </div>
                <Button type="button" onClick={onClose} autoFocus>
                    关闭
                </Button>
            </Row>
            <p>
                <DeviceId clientId={clientId} />
            </p>
            <Row>
                <Button
                    type="button"
                    onClick={() => {
                        void copyDeviceId(clientId).then(setCopied)
                    }}
                >
                    复制设备 ID
                </Button>
                <span role="status">{copied}</span>
            </Row>
            {error && (
                <Alert role="alert">
                    {error.message}
                    <Button type="button" onClick={refresh}>
                        重试
                    </Button>
                </Alert>
            )}
            {loading && !profile && <Muted role="status">正在读取画像…</Muted>}
            {profile && (
                <>
                    <Card $artwork="analyticsDevices">
                        <h3>{profile.client.name}</h3>
                        <Muted>
                            注册于 {localTime(profile.client.createdAt)} ·{" "}
                            {profile.client.revokedAt ? "已撤销" : "正常"}
                        </Muted>
                        <Muted>
                            最近保留调用：{localTime(profile.lastObservedCall)}
                        </Muted>
                    </Card>
                    <DeviceActivityProfile clientId={clientId} />
                    <Metrics>
                        {[
                            [
                                "近 7 天业务调用",
                                fmt(profile.last7Days.requests)
                            ],
                            [
                                "近 30 天业务调用",
                                fmt(profile.last30Days.requests)
                            ],
                            [
                                "近 30 天翻译字符",
                                fmt(profile.last30Days.characters)
                            ],
                            ["近 30 天活跃天数", fmt(profile.activeDaysLast30)]
                        ].map(([label, value]) => (
                            <Metric key={label}>
                                {label}
                                <strong>{value}</strong>
                            </Metric>
                        ))}
                    </Metrics>
                    <Card $artwork="analyticsLanguages">
                        <h3>行为与语言</h3>
                        <Languages items={profile.languages} />
                        <Muted>
                            活跃时段（UTC）：
                            {profile.activeHoursUtc.length
                                ? profile.activeHoursUtc
                                      .map(
                                          hour =>
                                              `${hour.hour}:00 (${fmt(hour.requests)} 次)`
                                      )
                                      .join(" · ")
                                : "暂无"}
                        </Muted>
                        {profile.errors.map(item => (
                            <Muted key={item.code}>
                                {item.code}：{fmt(item.requests)} 次
                            </Muted>
                        ))}
                    </Card>
                    <Card $artwork="analyticsRecords">
                        <AnalysisStatus data={profile.analysis} />
                        {profile.topics.length > 0 && (
                            <>
                                <h4>近期翻译主题</h4>
                                {profile.topics.map(item => (
                                    <Muted key={item.topic}>
                                        {item.topic} · {percent(item.share)} ·{" "}
                                        {fmt(item.samples)} 样本
                                    </Muted>
                                ))}
                            </>
                        )}
                        {profile.keywords.length > 0 && (
                            <Muted>
                                关键词：
                                {profile.keywords
                                    .map(
                                        item =>
                                            `${item.keyword} (${fmt(item.samples)})`
                                    )
                                    .join("、")}
                            </Muted>
                        )}
                        <Muted>
                            主题反映近期翻译内容倾向，不代表用户身份或自述。
                        </Muted>
                    </Card>
                    <Button type="button" onClick={() => onCalls(clientId)}>
                        查看该设备调用记录
                    </Button>
                    <Muted>
                        画像截至 {localTime(profile.asOf)}
                        ；数据仅来自此后端收到的调用。
                        {(!profile.coverage.aggregateComplete ||
                            !profile.coverage.callsComplete) &&
                            " 部分历史数据覆盖不足，未观察的历史不代表没有调用。"}{" "}
                        最早观察日：
                        {profile.coverage.earliestObservedDay ?? "暂无"}。
                    </Muted>
                </>
            )}
        </Dialog>,
        document.body
    )
}
