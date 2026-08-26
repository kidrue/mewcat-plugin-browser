import {
    arrow,
    autoUpdate,
    flip,
    offset as floatingOffset,
    shift,
    useFloating
} from "@floating-ui/react"
import React, { useCallback, useEffect, useRef, useState } from "react"
import styled from "styled-components"

export type TooltipPosition = "top" | "bottom" | "left" | "right"
export type TooltipTrigger = "hover" | "click" | "both"

interface TooltipProps {
    content: React.ReactNode
    children: React.ReactElement
    position?: TooltipPosition
    trigger?: TooltipTrigger
    delay?: number
    offset?: number
    disabled?: boolean
    className?: string
    width?: number | string
}

const SCxTooltipWrapper = styled.div`
    position: relative;
    display: inline-block;
`

const SCxTooltipContent = styled.div.withConfig({
    shouldForwardProp: prop => !["show", "width"].includes(prop)
})<{
    show: boolean
    width?: number | string
}>`
    background: var(--gray-900, #1a1714);
    color: var(--text-inverse, #fbf8f0);
    padding: 6px 10px;
    border-radius: var(--radius-md);
    font-size: 12px;
    line-height: 1.5;
    opacity: ${props => (props.show ? 1 : 0)};
    visibility: ${props => (props.show ? "visible" : "hidden")};
    transition: all 0.2s ease;
    pointer-events: ${props => (props.show ? "auto" : "none")};
    z-index: 1000;
    max-width: 300px;
    overflow-wrap: break-word;
    /* 没给宽度时按内容定宽 —— 否则会去参照定位父级（可能只有 54px 的悬浮球）折行 */
    width: max-content;
    ${props =>
        props.width
            ? typeof props.width === "number"
                ? `width: ${props.width}px;`
                : `width: ${props.width};`
            : ""}
`

const SCxTooltipArrow = styled.div`
    position: absolute;
    width: 10px;
    height: 10px;
    background: var(--gray-900, #1a1714);
    border-radius: calc(var(--radius-sm) / 3);
    transform: rotate(45deg);
    z-index: -1;
`

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
    const clearDelayTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = undefined
        }
    }

    // 显示 tooltip
    const showTooltip = (mode: "hover" | "click") => {
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
    }

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
        [activeMode]
    )

    // 处理鼠标事件
    const handleMouseEnter = () => {
        if (disabled) {
            return
        }
        if (trigger === "hover" || trigger === "both") {
            showTooltip("hover")
        }
    }

    const handleMouseLeave = () => {
        if (disabled) {
            return
        }
        if (trigger === "hover" || trigger === "both") {
            hideTooltip("hover")
        }
    }

    // 处理点击事件
    const handleClick = (e: React.MouseEvent) => {
        if (trigger === "click" || trigger === "both") {
            e.stopPropagation()
            if (show && activeMode === "click") {
                hideTooltip("click")
            } else {
                showTooltip("click")
            }
        }
    }

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
    }, [hideTooltip, activeMode, refs])

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

export default Tooltip
