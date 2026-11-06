import type { AnalyticsCalls, AnalyticsDevices } from "@mewcat/client"
import { analyticsRoutes } from "@mewcat/client"
import React, { useState } from "react"

import { DeviceId } from "./DeviceId"
import {
    Button,
    Card,
    Field,
    Filters,
    fmt,
    localTime,
    Mono,
    Muted,
    TableScroll
} from "./styles"

export interface RecordFilters {
    clientId: string
    route: string
    outcome: string
}
export function RecordFilterForm({
    kind,
    initial,
    onApply
}: {
    kind: "devices" | "calls"
    initial: RecordFilters
    onApply: (value: RecordFilters) => void
}) {
    const [value, setValue] = useState(initial)
    return (
        <Filters
            onSubmit={event => {
                event.preventDefault()
                onApply(value)
            }}
        >
            <Field>
                设备 ID（精确匹配，可留空）
                <input
                    aria-label="设备 ID"
                    value={value.clientId}
                    onChange={event =>
                        setValue({ ...value, clientId: event.target.value })
                    }
                    placeholder="完整设备 UUID"
                    spellCheck={false}
                />
            </Field>
            {kind === "calls" && (
                <>
                    <Field>
                        接口
                        <select
                            aria-label="接口"
                            value={value.route}
                            onChange={event =>
                                setValue({
                                    ...value,
                                    route: event.target.value
                                })
                            }
                        >
                            <option value="">全部业务接口</option>
                            {analyticsRoutes.map(route => (
                                <option key={route} value={route}>
                                    {route}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field>
                        结果
                        <select
                            aria-label="调用结果"
                            value={value.outcome}
                            onChange={event =>
                                setValue({
                                    ...value,
                                    outcome: event.target.value
                                })
                            }
                        >
                            <option value="">全部结果</option>
                            <option value="success">成功</option>
                            <option value="failed">全部失败（含拒绝）</option>
                            <option value="rejected">被拒绝（4xx）</option>
                        </select>
                    </Field>
                </>
            )}
            <Button type="submit">应用筛选</Button>
        </Filters>
    )
}
export function Devices({
    data,
    onProfile
}: {
    data: AnalyticsDevices
    onProfile: (id: string) => void
}) {
    return (
        <Card>
            <h3>设备画像</h3>
            <Muted>
                业务调用包含注册、额度查询和反馈。统计范围内的活跃设备，按设备
                ID 排序。
            </Muted>
            {data.items.length ? (
                <TableScroll>
                    <table>
                        <thead>
                            <tr>
                                <th>设备</th>
                                <th>业务调用</th>
                                <th>翻译字符</th>
                                <th>最近活跃（UTC 日）</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map(item => (
                                <tr key={item.client.id}>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onProfile(item.client.id)
                                            }
                                        >
                                            {item.client.name}
                                        </button>
                                        <Muted>
                                            <DeviceId
                                                clientId={item.client.id}
                                                truncated
                                            />
                                        </Muted>
                                    </td>
                                    <td>
                                        <Mono>{fmt(item.requests)}</Mono>
                                    </td>
                                    <td>
                                        <Mono>{fmt(item.characters)}</Mono>
                                    </td>
                                    <td>{item.lastObservedDay}</td>
                                    <td>
                                        {item.client.revokedAt
                                            ? "已撤销"
                                            : "正常"}
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onProfile(item.client.id)
                                            }
                                        >
                                            查看画像 ›
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableScroll>
            ) : (
                <Muted>暂无设备记录</Muted>
            )}
        </Card>
    )
}
export function Calls({ data }: { data: AnalyticsCalls }) {
    return (
        <Card>
            <h3>调用记录</h3>
            <Muted>
                时间按浏览器时区显示；仅展示受控元数据，按时间正序分页。
            </Muted>
            {data.items.length ? (
                <TableScroll>
                    <table>
                        <thead>
                            <tr>
                                <th>时间 / 设备</th>
                                <th>接口</th>
                                <th>结果</th>
                                <th>字符 / token</th>
                                <th>耗时</th>
                                <th>详情</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <Mono>{localTime(item.createdAt)}</Mono>
                                        <Muted>
                                            <DeviceId
                                                clientId={item.clientId}
                                                truncated
                                            />
                                        </Muted>
                                    </td>
                                    <td>
                                        <Mono>{item.route}</Mono>
                                    </td>
                                    <td>
                                        {item.statusCode} ·{" "}
                                        {item.statusCode < 400
                                            ? "成功"
                                            : item.statusCode < 500
                                              ? "被拒绝"
                                              : "失败"}
                                        {item.errorCode && (
                                            <Muted>
                                                <Mono>{item.errorCode}</Mono>
                                            </Muted>
                                        )}
                                    </td>
                                    <td>
                                        <Mono>
                                            {item.translation
                                                ? `${fmt(item.translation.characters)} / ${item.translation.promptTokens == null || item.translation.completionTokens == null ? "未知" : fmt(item.translation.promptTokens + item.translation.completionTokens)}`
                                                : "—"}
                                        </Mono>
                                    </td>
                                    <td>
                                        <Mono>{fmt(item.durationMs)} ms</Mono>
                                    </td>
                                    <td>
                                        <details>
                                            <summary>执行元数据</summary>
                                            <Muted>
                                                设备 ID：
                                                <DeviceId
                                                    clientId={item.clientId}
                                                />
                                            </Muted>
                                            {item.translation && (
                                                <>
                                                    <Muted>
                                                        语言：
                                                        {item.translation
                                                            .sourceLanguage ??
                                                            "未知"}{" "}
                                                        →{" "}
                                                        {item.translation
                                                            .targetLanguage ??
                                                            "未知"}
                                                    </Muted>
                                                    <Muted>
                                                        模型：
                                                        {item.translation
                                                            .model ?? "未知"}
                                                    </Muted>
                                                </>
                                            )}
                                            {item.analysis ? (
                                                <>
                                                    <Muted>
                                                        主题：
                                                        {item.analysis.topics
                                                            .map(
                                                                topic =>
                                                                    `${topic.topic} (${Math.round(topic.confidence * 100)}%)`
                                                            )
                                                            .join("、")}
                                                    </Muted>
                                                    <Muted>
                                                        关键词：
                                                        {item.analysis.keywords.join(
                                                            "、"
                                                        ) || "暂无"}
                                                    </Muted>
                                                </>
                                            ) : (
                                                <Muted>暂无内容分析结果</Muted>
                                            )}
                                        </details>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableScroll>
            ) : (
                <Muted>当前筛选下暂无调用记录</Muted>
            )}
        </Card>
    )
}
