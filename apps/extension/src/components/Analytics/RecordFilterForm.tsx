import { analyticsRoutes } from "@mewcat/client"
import React, { useState } from "react"

import { Button, Field, Filters } from "./styles"
import type { RecordFilterFormProps } from "./types"

export const RecordFilterForm: React.FC<RecordFilterFormProps> = ({
    kind,
    initial,
    onApply
}) => {
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
