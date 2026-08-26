import React from "react"
import styled from "styled-components"

interface LoadingDotsProps {
    /** 是否显示loading动画 */
    loading?: boolean
    /** 点的颜色，默认为白色 */
    color?: string
    /** 点的大小，默认为6px */
    size?: number
    /** 点之间的间距，默认为4px */
    gap?: number
    /** 动画时长，默认为1.2秒 */
    duration?: number
}

const SCxLoadingContainer = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "loading"
})<{ loading: boolean; gap: number }>`
    display: ${props => (props.loading ? "flex" : "none")};
    align-items: center;
    justify-content: center;
    gap: ${props => props.gap}px;
`

const SCxLoadingDot = styled.div<{
    delay: number
    color: string
    size: number
    duration: number
}>`
    width: ${props => props.size}px;
    height: ${props => props.size}px;
    border-radius: var(--radius-full);
    background: ${props => props.color};
    animation: pulse ${props => props.duration}s ease-in-out infinite;
    animation-delay: ${props => props.delay}s;

    @keyframes pulse {
        0%,
        80%,
        100% {
            transform: scale(0.8);
            opacity: 0.5;
        }
        40% {
            transform: scale(1.2);
            opacity: 1;
        }
    }
`

/**
 * 通用的加载点动画组件
 * 三个点依次脉冲闪烁，提供优雅的加载反馈
 */
const LoadingDots: React.FC<LoadingDotsProps> = ({
    loading = false,
    color = "white",
    size = 6,
    gap = 4,
    duration = 1.2
}) => {
    return (
        <SCxLoadingContainer loading={loading} gap={gap}>
            <SCxLoadingDot
                delay={0}
                color={color}
                size={size}
                duration={duration}
            />
            <SCxLoadingDot
                delay={0.2}
                color={color}
                size={size}
                duration={duration}
            />
            <SCxLoadingDot
                delay={0.4}
                color={color}
                size={size}
                duration={duration}
            />
        </SCxLoadingContainer>
    )
}

export default LoadingDots
