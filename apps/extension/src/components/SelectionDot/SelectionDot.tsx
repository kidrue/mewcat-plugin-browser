import React, { useCallback } from "react"

import Icon from "../Icon"
import { SCxDot, SCxTooltip } from "./styles"
import type { SelectionDotProps } from "./types"

// 划词翻译触发点组件
// 支持不同触发模式下的显示和交互
export const SelectionDot = React.forwardRef<HTMLDivElement, SelectionDotProps>(
    (
        { x, y, onClick, onMouseEnter, interactionMode, triggerMode = "dot" },
        ref
    ) => {
        const [showTooltip, setShowTooltip] = React.useState(false)

        const handleMouseEnter = useCallback(() => {
            setShowTooltip(true)
            if (interactionMode === "hover" && onMouseEnter) {
                onMouseEnter()
            }
        }, [interactionMode, onMouseEnter])

        const handleMouseLeave = useCallback(() => {
            setShowTooltip(false)
        }, [])

        const handleClick = useCallback(() => {
            if (interactionMode === "click") {
                onClick()
            }
        }, [interactionMode, onClick])

        // 根据触发模式生成提示文本
        const getTooltipText = useCallback(() => {
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
        }, [interactionMode, triggerMode])

        // 根据触发模式调整图标
        const getIcon = useCallback(() => {
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
        }, [triggerMode])

        return (
            <SCxDot
                ref={ref}
                x={x}
                y={y}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <Icon name={getIcon()} size={14} color="#ffffff" />
                <SCxTooltip show={showTooltip}>{getTooltipText()}</SCxTooltip>
            </SCxDot>
        )
    }
)
