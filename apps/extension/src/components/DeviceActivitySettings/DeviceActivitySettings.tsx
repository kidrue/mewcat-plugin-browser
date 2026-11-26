import * as React from "react"

import Button from "@/components/Button"
import FormRow from "@/components/FormRow"
import OptionsSection, { OptionsSectionNote } from "@/components/OptionsSection"
import Switch from "@/components/Switch"
import { sendMessage } from "@/messaging"
import type { DeviceActivityStatus } from "@/messaging/protocol"

import { activityStatusRequest } from "./constants"
import type { ActivitySettingRequest } from "./types"

export const DeviceActivitySettings: React.FC = () => {
    const controlId = React.useId()

    const [status, setStatus] = React.useState<DeviceActivityStatus | null>(
        null
    )
    const [pending, setPending] = React.useState(true)
    const [retry, setRetry] = React.useState<ActivitySettingRequest | null>(
        null
    )

    const update = React.useCallback(
        async (request: ActivitySettingRequest) => {
            setPending(true)
            try {
                const result = await sendMessage("device-activity", request)
                if (typeof result?.enabled !== "boolean") {
                    throw new Error("Missing activity status")
                }
                setStatus(result)
                setRetry(result.message ? request : null)
            } catch {
                setStatus(null)
                setRetry(request)
            } finally {
                setPending(false)
            }
        },
        []
    )

    React.useEffect(() => {
        void update(activityStatusRequest)
    }, [update])

    let statusText = status?.enabled ? "使用统计已开启。" : "使用统计已关闭。"
    if (!status) {
        statusText = "无法读取使用统计状态，请重试。"
    }
    if (status?.message) {
        statusText = status.message
    }
    if (pending) {
        statusText = "正在读取或更新使用统计…"
    }

    return (
        <OptionsSection title="使用统计" artwork="usagePrivacy" icon="ledger">
            <FormRow
                label="分享使用统计"
                controlId={controlId}
                description="服务器管理员可查看随机设备 ID、经授权的安装与确认卸载记录，以及翻译页数。网页地址仅在本地用于生成加盐的页面标识，单页统计明细最多保存 90 天。"
            >
                <Switch
                    id={controlId}
                    aria-describedby={`${controlId}-description`}
                    checked={status?.enabled ?? false}
                    disabled={pending || !status}
                    onChange={enabled =>
                        void update({ type: "set-enabled", enabled })
                    }
                />
                <div role="status">{statusText}</div>
                {retry && (
                    <Button
                        type="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() => void update(retry)}
                    >
                        重试
                    </Button>
                )}
            </FormRow>
            <OptionsSectionNote>
                开启后，Chrome
                会在卸载时发送回执。关闭统计会停止上报并请求删除本设备的统计数据。
            </OptionsSectionNote>
        </OptionsSection>
    )
}
