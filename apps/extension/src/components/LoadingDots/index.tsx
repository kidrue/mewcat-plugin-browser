import React from "react"
import styled from "styled-components"

import { RUNNING_CAT_CSS, RUNNING_CAT_SVG } from "@/utils/runningCat"

interface LoadingDotsProps {
    /** 是否显示加载动画 */
    loading?: boolean
    /** 地面阴影的颜色，默认为白色；小猫保持参考图的三花配色 */
    color?: string
    /** 保留原加载点的尺寸参数，用于计算小猫宽度 */
    size?: number
    /** 保留原加载点的间距参数，用于计算小猫宽度 */
    gap?: number
    /** 奔跑周期，默认为 0.72 秒 */
    duration?: number
}

const SCxLoadingContainer = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    vertical-align: middle;
    line-height: 0;

    ${RUNNING_CAT_CSS.replace(/\.mewcat-running-cat/g, "&")}
`

/** 保留原组件接口，让所有使用加载点的界面统一显示奔跑小猫。 */
const LoadingDots: React.FC<LoadingDotsProps> = ({
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

export default LoadingDots
