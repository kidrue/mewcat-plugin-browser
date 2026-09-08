import * as React from "react"
import { styled } from "styled-components"

import FormRow from "@/components/FormRow"
import NativeSelect from "@/components/NativeSelect"
import {
    getOfficialEndpointOptions,
    isTokenPlanEndpoint
} from "@/model-management/providers"
import { AiModel_Platform_Enum, type BaseModel } from "@/types/aiModel"

const TokenPlanNote = styled.div`
    padding: var(--space-3);
    border: 1px solid var(--border-light);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);

    a {
        color: var(--primary-color);
    }
`

interface BailianOfficialEndpointFieldsProps {
    model: BaseModel
    onEndpointChange: (officialEndpointId: string) => void
}

export function canExplicitlyConfigureVision(model: BaseModel): boolean {
    const isOfficial = model.params.isOfficial !== false
    return (
        !isOfficial ||
        isTokenPlanEndpoint({
            provider: model.type,
            isOfficial,
            officialEndpointId: model.params.officialEndpointId
        })
    )
}

export function BailianOfficialEndpointFields({
    model,
    onEndpointChange
}: BailianOfficialEndpointFieldsProps): React.ReactElement | null {
    const isOfficial = model.params.isOfficial !== false
    if (model.type !== AiModel_Platform_Enum.BAILIAN || !isOfficial) {
        return null
    }

    const options = getOfficialEndpointOptions(AiModel_Platform_Enum.BAILIAN)
    const endpointId = model.params.officialEndpointId ?? "pay-as-you-go-cn"
    const isTokenPlan = isTokenPlanEndpoint({
        provider: model.type,
        isOfficial,
        officialEndpointId: model.params.officialEndpointId
    })

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
            {isTokenPlan && (
                <TokenPlanNote role="note">
                    Token Plan 仅适用于阿里云公布的使用范围。请使用当前地区的
                    sk-sp- 专属 API Key；切换通道后请重新检测连接。{" "}
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
