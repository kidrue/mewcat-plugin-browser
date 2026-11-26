import React from "react"

import { RUNNING_CAT_SVG } from "@/utils/runningCat"

import { SCxLoadingContainer } from "./styles"
import type { LoadingDotsProps } from "./types"

/** 保留原组件接口，让所有使用加载点的界面统一显示奔跑小猫。 */
export const LoadingDots: React.FC<LoadingDotsProps> = ({
    loading = false,
    color = "white",
    size = 6,
    gap = 4,
    duration = 0.72
}) => {
    if (!loading) {
        return null
    }

    const width = Math.max(40, size * 3 + gap * 2)

    return (
        <SCxLoadingContainer
            className="mewcat-running-cat"
            role="status"
            aria-label="加载中"
            style={
                {
                    color,
                    width,
                    height: (width * 40) / 64,
                    "--mewcat-cat-duration": `${Math.max(0.2, duration)}s`
                } as React.CSSProperties
            }
            dangerouslySetInnerHTML={{ __html: RUNNING_CAT_SVG }}
        />
    )
}
