import * as React from "react"

import FormRow from "@/components/FormRow"
import NativeSelect from "@/components/NativeSelect"
import { getOfficialEndpointOptions } from "@/features/model-management"
import { AiModel_Platform_Enum } from "@/types/aiModel"

import { ConfigurationError, TokenPlanNote } from "./styles"
import type { BailianOfficialEndpointFieldsProps } from "./types"

export const BailianOfficialEndpointFields: React.FC<
    BailianOfficialEndpointFieldsProps
> = ({ model, onEndpointChange }) => {
    const isOfficial = model.params.isOfficial !== false
    if (model.type !== AiModel_Platform_Enum.BAILIAN || !isOfficial) {
        return null
    }

    const options = getOfficialEndpointOptions(AiModel_Platform_Enum.BAILIAN)
    const endpointId = model.params.officialEndpointId ?? "pay-as-you-go-cn"
    const selectedEndpoint = options.find(option => option.id === endpointId)
    const hasInvalidEndpoint = !selectedEndpoint
    const isTokenPlan = selectedEndpoint?.mode === "token-plan"

    return (
        <>
            <FormRow
                label="官方通道"
                description="选择对应计费计划和区域的阿里百炼官方通道"
                controlId={`bailian-official-endpoint-${model.id}`}
            >
                <NativeSelect
                    id={`bailian-official-endpoint-${model.id}`}
                    value={endpointId}
                    onChange={onEndpointChange}
                    options={options.map(option => ({
                        value: option.id,
                        label: option.label
                    }))}
                    placeholder=""
                />
            </FormRow>
            {hasInvalidEndpoint && (
                <ConfigurationError role="alert">
                    当前官方通道配置无效，请重新选择官方通道或切换为自定义地址。
                </ConfigurationError>
            )}
            {isTokenPlan && (
                <TokenPlanNote role="note">
                    Token Plan
                    仅适用于阿里云公布的使用范围。浏览器翻译扩展可能属于不支持的自定义应用程序，存在订阅被暂停或
                    API Key 被封禁的风险。请使用当前地区的 sk-sp- 专属 API
                    Key；切换通道后请重新检测连接。{" "}
                    <a
                        href="https://help.aliyun.com/zh/model-studio/more-tools"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        查看官方使用范围
                    </a>
                </TokenPlanNote>
            )}
        </>
    )
}
