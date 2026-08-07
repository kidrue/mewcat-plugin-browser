import React from "react"
import styled from "styled-components"

import Icon from "../Icon"

interface SelectionDotProps {
    x: number
    y: number
    onClick: () => void
    onMouseEnter?: () => void
    interactionMode: "click" | "hover"
    triggerMode?: "direct" | "dot" | "shift" | "ctrl"
}

const SCxDot = styled.div<{ x: number; y: number }>`
    position: fixed;
    left: ${props => props.x}px;
    top: ${props => props.y}px;
    z-index: 100000;
    width: 24px;
    height: 24px;
    /* 一枚小朱砂印 —— 与页面悬浮球同形制 */
    background: #b23a2e;
    border-radius: 4px;
    box-shadow:
        inset 0 0 0 1px rgba(251, 248, 240, 0.55),
        0 2px 6px rgba(142, 42, 32, 0.24);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transform: translate(-50%, -100%) translateY(-8px);
    transition: all 0.16s ease;
    opacity: 0;
    animation: fadeInScale 0.2s ease-out forwards;

    &:hover {
        transform: translate(-50%, -100%) translateY(-9px);
    }

    &:active {
        transform: translate(-50%, -100%) translateY(-8px) scale(0.95);
    }

    @keyframes fadeInScale {
        0% {
            opacity: 0;
            transform: translate(-50%, -100%) translateY(-8px) scale(0.85);
        }
        100% {
            opacity: 1;
            transform: translate(-50%, -100%) translateY(-8px) scale(1);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        animation: none;
        opacity: 1;
    }
`

const SCxTooltip = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "show"
})<{ show: boolean }>`
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    background: #1a1714;
    color: #fbf8f0;
    padding: 4px 8px;
    border-radius: 2px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    opacity: ${props => (props.show ? 1 : 0)};
    visibility: ${props => (props.show ? "visible" : "hidden")};
    transition: opacity 0.16s ease;
    pointer-events: none;

    &::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: #1a1714;
    }
`

/**
 * 划词翻译触发点组件
 * 支持不同触发模式下的显示和交互
 */
const SelectionDot = React.forwardRef<HTMLDivElement, SelectionDotProps>(
    (
        { x, y, onClick, onMouseEnter, interactionMode, triggerMode = "dot" },
        ref
    ) => {
        const [showTooltip, setShowTooltip] = React.useState(false)

        const handleMouseEnter = () => {
            setShowTooltip(true)
            if (interactionMode === "hover" && onMouseEnter) {
                onMouseEnter()
            }
        }

        const handleMouseLeave = () => {
            setShowTooltip(false)
        }

        const handleClick = () => {
            if (interactionMode === "click") {
                onClick()
            }
        }

        // 根据触发模式生成提示文本
        const getTooltipText = () => {
            const interaction = interactionMode === "hover" ? "悬停" : "点击"
            switch (triggerMode) {
                case "shift":
                    return `${interaction}翻译 (需按住Shift)`
                case "ctrl":
                    return `${interaction}翻译 (需按住Ctrl)`
                case "dot":
                    return `${interaction}翻译`
                case "direct":
                default:
                    return `${interaction}翻译`
            }
        }

        // 根据触发模式调整图标
        const getIcon = () => {
            switch (triggerMode) {
                case "shift":
                    return "keyboard"
                case "ctrl":
                    return "keyboard"
                case "dot":
                case "direct":
                default:
                    return "translate"
            }
        }

        return (
            <SCxDot
                ref={ref}
                x={x}
                y={y}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <Icon name={getIcon()} size={14} color="#fbf8f0" />
                <SCxTooltip show={showTooltip}>{getTooltipText()}</SCxTooltip>
            </SCxDot>
        )
    }
)

export default SelectionDot
