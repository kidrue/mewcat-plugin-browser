import { analyticsQuerySchema, type AnalyticsInput } from "@mewcat/client"
import React, { useEffect, useState } from "react"

import { OptionsPageIntro } from "@/components/OptionsPageLayout"
import { getAnalyticsIdentity } from "@/services/analytics"
import {
    analyticsFailure,
    type AnalyticsIdentityResponse
} from "@/types/analytics"

import { copyDeviceId } from "./analytics/clipboard"
import { Overview } from "./analytics/Overview"
import { Profile } from "./analytics/Profile"
import {
    Calls,
    Devices,
    RecordFilterForm,
    type RecordFilters
} from "./analytics/Records"
import {
    Alert,
    Button,
    Card,
    Field,
    LoadingCards,
    localTime,
    Mono,
    Muted,
    Page,
    Row,
    Tabs,
    Toolbar
} from "./analytics/styles"
import { useAnalyticsRequest } from "./analytics/useAnalyticsRequest"

const day = (time: number) => new Date(time).toISOString().slice(0, 10)
const emptyFilters: RecordFilters = { clientId: "", route: "", outcome: "" }
function dates(days: number) {
    const end = day(Date.now())
    return { from: day(Date.parse(end) - (days - 1) * 86400000), end }
}
export function Analytics() {
    const [identity, setIdentity] = useState<AnalyticsIdentityResponse | null>(
        null
    )
    const [identityRevision, setIdentityRevision] = useState(0)
    const [view, setView] = useState<"overview" | "devices" | "calls">(
        "overview"
    )
    const [range, setRange] = useState(() => dates(7))
    const [filters, setFilters] = useState<RecordFilters>(emptyFilters)
    const [cursors, setCursors] = useState<Array<string | undefined>>([
        undefined
    ])
    const [profile, setProfile] = useState<string | null>(null)
    const [copied, setCopied] = useState("")
    useEffect(() => {
        let active = true
        void getAnalyticsIdentity()
            .catch(analyticsFailure)
            .then(value => {
                if (active) {
                    setIdentity(value)
                }
            })
        return () => {
            active = false
        }
    }, [identityRevision])
    const endTime = Date.parse(range.end)
    const to = Number.isFinite(endTime) ? day(endTime + 86400000) : ""
    const candidate = {
        operation: view,
        from: range.from,
        to,
        ...(view !== "overview"
            ? {
                  limit: 20,
                  ...(filters.clientId.trim()
                      ? { clientId: filters.clientId.trim() }
                      : {}),
                  ...(cursors.at(-1) ? { cursor: cursors.at(-1) } : {})
              }
            : {}),
        ...(view === "calls"
            ? {
                  ...(filters.route ? { route: filters.route } : {}),
                  ...(filters.outcome ? { outcome: filters.outcome } : {})
              }
            : {})
    }
    const parsed = analyticsQuerySchema.safeParse(candidate)
    const request = useAnalyticsRequest(
        parsed.success ? (parsed.data as AnalyticsInput) : null
    )
    const { data, error, loading, refresh } = request
    const forbidden =
        error &&
        ["ANALYTICS_FORBIDDEN", "CLIENT_REVOKED", "UNAUTHORIZED"].includes(
            error.code
        )
    const changeView = (next: typeof view) => {
        setView(next)
        setFilters(emptyFilters)
        setCursors([undefined])
    }
    const nextCursor =
        data && (data.operation === "devices" || data.operation === "calls")
            ? data.nextCursor
            : null
    const retry = () => {
        setIdentityRevision(value => value + 1)
        refresh()
    }
    return (
        <Page>
            <OptionsPageIntro
                title="管理员分析"
                description="查看服务概览、设备行为与调用记录。仅管理员设备可访问。"
                scene="archive"
                icon="ledger"
            >
                <Button
                    type="button"
                    onClick={() => {
                        location.hash = "about"
                    }}
                >
                    返回关于
                </Button>
            </OptionsPageIntro>
            {forbidden ? (
                <Card>
                    <h3>{error.message}</h3>
                    <Muted>
                        如需访问，请将本设备 ID 提供给服务管理员加入白名单。
                    </Muted>
                    {identity?.success === true ? (
                        <>
                            <Muted>本设备 ID</Muted>
                            <p>
                                <Mono>{identity.data.clientId}</Mono>
                            </p>
                            <Row>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        void copyDeviceId(
                                            identity.data.clientId
                                        ).then(setCopied)
                                    }}
                                >
                                    复制设备 ID
                                </Button>
                                <span role="status">{copied}</span>
                            </Row>
                        </>
                    ) : (
                        <Muted>
                            {identity && identity.success === false
                                ? identity.message
                                : "正在读取本机设备 ID…"}
                        </Muted>
                    )}
                    <Row style={{ marginTop: 20 }}>
                        <Button
                            type="button"
                            onClick={retry}
                            disabled={loading}
                        >
                            重新检查
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                location.hash = "about"
                            }}
                        >
                            返回关于
                        </Button>
                    </Row>
                </Card>
            ) : (
                <>
                    <Toolbar>
                        <Tabs aria-label="分析视图">
                            {(
                                [
                                    ["overview", "全站概览"],
                                    ["devices", "设备画像"],
                                    ["calls", "调用记录"]
                                ] as const
                            ).map(([key, label]) => (
                                <button
                                    type="button"
                                    key={key}
                                    data-view={key}
                                    aria-pressed={view === key}
                                    onClick={() => changeView(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </Tabs>
                        <Row>
                            <Button
                                type="button"
                                aria-pressed={
                                    range.from === dates(7).from &&
                                    range.end === dates(7).end
                                }
                                onClick={() => {
                                    setRange(dates(7))
                                    setCursors([undefined])
                                }}
                            >
                                近 7 天
                            </Button>
                            <Button
                                type="button"
                                aria-pressed={
                                    range.from === dates(30).from &&
                                    range.end === dates(30).end
                                }
                                onClick={() => {
                                    setRange(dates(30))
                                    setCursors([undefined])
                                }}
                            >
                                近 30 天
                            </Button>
                            <Button
                                type="button"
                                data-action="refresh"
                                onClick={refresh}
                                disabled={loading}
                            >
                                刷新
                            </Button>
                        </Row>
                    </Toolbar>
                    <Row>
                        <Field>
                            开始日期（UTC）
                            <input
                                type="date"
                                value={range.from}
                                onChange={event => {
                                    setRange({
                                        ...range,
                                        from: event.target.value
                                    })
                                    setCursors([undefined])
                                }}
                            />
                        </Field>
                        <Field>
                            结束日期（包含当日）
                            <input
                                type="date"
                                value={range.end}
                                onChange={event => {
                                    setRange({
                                        ...range,
                                        end: event.target.value
                                    })
                                    setCursors([undefined])
                                }}
                            />
                        </Field>
                        <Muted>最长 90 天 · UTC 日界对应北京时间 08:00</Muted>
                    </Row>
                    {view !== "overview" && (
                        <RecordFilterForm
                            key={`${view}:${filters.clientId}`}
                            kind={view}
                            initial={filters}
                            onApply={value => {
                                setFilters(value)
                                setCursors([undefined])
                            }}
                        />
                    )}
                    {!parsed.success && (
                        <Alert role="alert">
                            查询条件不正确，请填写有效日期（1–90 天）和完整设备
                            UUID。
                        </Alert>
                    )}
                    {error && (
                        <Alert role="alert">
                            {error.message}
                            {data && "；正在显示上次成功读取的数据。"}
                            <Button
                                type="button"
                                onClick={refresh}
                                disabled={loading}
                            >
                                重试
                            </Button>
                        </Alert>
                    )}
                    {identity && identity.success === false && (
                        <Alert role="alert">
                            {identity.message}
                            <Button type="button" onClick={retry}>
                                重新检查设备
                            </Button>
                        </Alert>
                    )}
                    {loading && (
                        <Alert role="status" aria-live="polite">
                            {data ? "正在刷新分析数据…" : "正在读取分析数据…"}
                        </Alert>
                    )}
                    {loading && !data && (
                        <LoadingCards aria-hidden="true">
                            {[0, 1, 2, 3].map(index => (
                                <div key={index} />
                            ))}
                        </LoadingCards>
                    )}
                    {data?.operation === "overview" && <Overview data={data} />}
                    {data?.operation === "devices" && (
                        <Devices data={data} onProfile={setProfile} />
                    )}
                    {data?.operation === "calls" && <Calls data={data} />}
                    {view !== "overview" && (data || cursors.length > 1) && (
                        <Toolbar>
                            <Muted>
                                第 {cursors.length} 页 · 每页最多 20 条
                            </Muted>
                            <Row>
                                <Button
                                    type="button"
                                    disabled={loading || cursors.length === 1}
                                    onClick={() =>
                                        setCursors(value => value.slice(0, -1))
                                    }
                                >
                                    上一页
                                </Button>
                                <Button
                                    type="button"
                                    disabled={loading || !nextCursor}
                                    onClick={() => {
                                        if (nextCursor) {
                                            setCursors(value => [
                                                ...value,
                                                nextCursor
                                            ])
                                        }
                                    }}
                                >
                                    下一页
                                </Button>
                            </Row>
                        </Toolbar>
                    )}
                    {data && (
                        <Muted>
                            最近成功更新：{localTime(data.asOf)} · 最早观察日：
                            {data.coverage.earliestObservedDay ?? "暂无"}
                            {(!data.coverage.aggregateComplete ||
                                !data.coverage.callsComplete) &&
                                " · 部分历史数据覆盖不足"}
                            <br />
                            仅统计此后端收到的调用，不包含扩展直接调用其他翻译服务的数据。
                        </Muted>
                    )}
                </>
            )}
            {profile && (
                <Profile
                    clientId={profile}
                    onClose={() => setProfile(null)}
                    onCalls={id => {
                        setProfile(null)
                        setView("calls")
                        setFilters({ ...emptyFilters, clientId: id })
                        setCursors([undefined])
                    }}
                />
            )}
        </Page>
    )
}
