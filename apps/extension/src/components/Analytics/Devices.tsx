import React from "react"

import { DeviceId } from "./DeviceId"
import { Card, fmt, Mono, Muted, TableScroll } from "./styles"
import type { DevicesProps } from "./types"

export const Devices: React.FC<DevicesProps> = ({ data, onProfile }) => {
    return (
        <Card $artwork="analyticsDevices">
            <h3>设备画像</h3>
            <Muted>
                按设备 ID
                排列区间内有活动记录的设备。业务调用包含注册、额度查询和反馈。
            </Muted>
            {data.items.length ? (
                <TableScroll>
                    <table>
                        <thead>
                            <tr>
                                <th>设备</th>
                                <th>业务调用</th>
                                <th>翻译字符</th>
                                <th>最近记录（UTC 日）</th>
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
