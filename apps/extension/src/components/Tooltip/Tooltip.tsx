import {
    arrow,
    autoUpdate,
    flip,
    offset as floatingOffset,
    shift,
    useFloating
} from "@floating-ui/react"
import React, { useCallback, useEffect, useRef, useState } from "react"

import { SCxTooltipArrow, SCxTooltipContent, SCxTooltipWrapper } from "./styles"
import type { TooltipProps } from "./types"

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = "top",
    trigger = "hover",
    delay = 0,
    offset = 8,
    disabled,
    className,
    width
}) => {
    const [show, setShow] = useState(false)
    const [activeMode, setActiveMode] = useState<"hover" | "click" | null>(null)

    const timeoutRef = useRef<NodeJS.Timeout>()
    const arrowRef = useRef<HTMLDivElement>(null)

    // 使用 floating-ui 进行位置计算
    const { refs, floatingStyles, placement, middlewareData } = useFloating({
        open: show,
        placement: position,
        middleware: [
            floatingOffset(offset),
            flip(),
            shift({ padding: 8 }),
            arrow({ element: arrowRef })
        ],
        whileElementsMounted: autoUpdate
    })

    // 清理定时器
    const clearDelayTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = undefined
        }
    }, [])

    // 显示 tooltip
    const showTooltip = useCallback(
        (mode: "hover" | "click") => {
            // 如果已经有其他模式激活，则不允许切换
            if (activeMode && activeMode !== mode) {
                return
            }

            clearDelayTimeout()
            setActiveMode(mode)
            if (delay > 0) {
                timeoutRef.current = setTimeout(() => setShow(true), delay)
            } else {
                setShow(true)
            }
        },
        [activeMode, clearDelayTimeout, delay]
    )

    // 隐藏 tooltip
    const hideTooltip = useCallback(
        (mode?: "hover" | "click") => {
            // 只有在匹配的模式下才能隐藏
            if (mode && activeMode !== mode) {
                return
            }

            clearDelayTimeout()
            setShow(false)
            setActiveMode(null)
        },
        [activeMode, clearDelayTimeout]
    )

    // 处理鼠标事件
    const handleMouseEnter = useCallback(() => {
        if (disabled) {
            return
        }
        if (trigger === "hover" || trigger === "both") {
            showTooltip("hover")
        }
    }, [disabled, showTooltip, trigger])

    const handleMouseLeave = useCallback(() => {
        if (disabled) {
            return
        }
        if (trigger === "hover" || trigger === "both") {
            hideTooltip("hover")
        }
    }, [disabled, hideTooltip, trigger])

    // 处理点击事件
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (trigger === "click" || trigger === "both") {
                e.stopPropagation()
                if (show && activeMode === "click") {
                    hideTooltip("click")
                } else {
                    showTooltip("click")
                }
            }
        },
        [activeMode, hideTooltip, show, showTooltip, trigger]
    )

    // 处理外部点击关闭
    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            const referenceEl = refs.reference.current
            const floatingEl = refs.floating.current

            if (
                activeMode === "click" &&
                referenceEl &&
                floatingEl &&
                "contains" in referenceEl &&
                !referenceEl.contains(event.target as Node) &&
                !floatingEl.contains(event.target as Node)
            ) {
                hideTooltip("click")
            }
        }

        if (activeMode === "click") {
            document.addEventListener("click", handleOutsideClick)
        }

        return () => {
            document.removeEventListener("click", handleOutsideClick)
            clearDelayTimeout()
        }
    }, [hideTooltip, activeMode, refs, clearDelayTimeout])

    // 克隆子元素并添加事件处理器
    const clonedChild = React.cloneElement(children, {
        ref: refs.setReference,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onClick: (e: React.MouseEvent) => {
            if (disabled) {
                return
            }
            // 保留原有的 onClick 事件
            if (children.props.onClick) {
                children.props.onClick(e)
            }
            handleClick(e)
        }
    })

    useEffect(() => {
        if (disabled) {
            setShow(false)
            setActiveMode(null)
        }
    }, [disabled])

    // 计算箭头位置
    // 箭头应该在 tooltip 的相反方向
    const staticSide = {
        top: "bottom",
        right: "left",
        bottom: "top",
        left: "right"
    }[placement.split("-")[0]] as string

    const arrowStyles: React.CSSProperties = middlewareData.arrow
        ? {
              left:
                  middlewareData.arrow.x != null
                      ? `${middlewareData.arrow.x}px`
                      : "",
              top:
                  middlewareData.arrow.y != null
                      ? `${middlewareData.arrow.y}px`
                      : "",
              [staticSide]: "-4px"
          }
        : {}

    return (
        <SCxTooltipWrapper className={className}>
            {clonedChild}
            <SCxTooltipContent
                ref={refs.setFloating}
                show={show}
                width={width}
                style={floatingStyles}
            >
                {content}
                <SCxTooltipArrow ref={arrowRef} style={arrowStyles} />
            </SCxTooltipContent>
        </SCxTooltipWrapper>
    )
}
