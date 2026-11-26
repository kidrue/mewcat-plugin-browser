import type React from "react"

import { openReadingSettings } from "@/features/reading/pageActions"

import Button from "../Button"
import type { FeatureAvailabilityProps } from "./types"

export const FeatureAvailability: React.FC<FeatureAvailabilityProps> = ({
    available,
    saved = false,
    section = "translation",
    message
}) => {
    return (
        <small role="status" style={{ display: "block", lineHeight: 1.6 }}>
            {available ? (
                "可使用"
            ) : (
                <>
                    待配置：
                    {message ??
                        (section === "image"
                            ? "请先选择可用的视觉模型。"
                            : "请先配置可用的生成式 AI 模型。")}
                    {saved && "已保留启用偏好，配置完成后生效。"}
                    <Button
                        htmlType="button"
                        type="ghost"
                        size="sm"
                        onClick={() => openReadingSettings(section)}
                    >
                        去配置
                    </Button>
                </>
            )}
        </small>
    )
}
