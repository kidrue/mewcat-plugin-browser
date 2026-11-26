import React from "react"

import { DeviceId } from "./DeviceId"
import { Card, fmt, localTime, Mono, Muted, TableScroll } from "./styles"
import type { CallsProps } from "./types"

export const Calls: React.FC<CallsProps> = ({ data }) => {
    return (
        <Card $artwork="analyticsRecords">
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
