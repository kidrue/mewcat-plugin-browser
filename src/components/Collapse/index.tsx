import React, { useCallback, useEffect, useRef, useState } from "react"
import styled, { css, keyframes } from "styled-components"

import Switch from "../Switch"

// 类型定义
export interface CollapseProps {
    /** 是否展开（受控模式） */
    open?: boolean
    /**  文本 */
    title?: string
    description?: string
    /** 左侧内容区域 */
    leftSection?: React.ReactNode
    /** 模式：auto-自动显示箭头，switch-显示切换开关 */
    mode?: "auto" | "switch"
    /** 自定义样式 */
    style?: React.CSSProperties
    /** 子内容 */
    children: React.ReactNode
    /** 状态变化回调 */
    onChange?: (open: boolean) => void
    /** 默认展开状态（非受控模式） */
    defaultOpen?: boolean
    /** 标题区域自定义渲染 */
    renderTitle?: (isOpen: boolean) => React.ReactNode
    /** 卡片样式配置 */
    cardStyle?: {
        borderColor?: string
        backgroundColor?: string
        hoverBackgroundColor?: string
    }
}

// 自定义Hook用于管理展开状态
const useCollapseState = (
    props: Pick<CollapseProps, "open" | "defaultOpen" | "onChange">
) => {
    const { open, defaultOpen = false, onChange } = props
    const isControlled = open !== undefined
    const [internalOpen, setInternalOpen] = useState(defaultOpen)

    const currentOpen = isControlled ? open : internalOpen

    const toggle = useCallback(() => {
        if (!isControlled) {
            setInternalOpen(prev => !prev)
        }
        onChange?.(!currentOpen)
    }, [isControlled, currentOpen, onChange])

    const setOpen = useCallback(
        (value: boolean) => {
            if (!isControlled) {
                setInternalOpen(value)
            }
            onChange?.(value)
        },
        [isControlled, onChange]
    )

    return { isOpen: currentOpen, toggle, setOpen }
}

// 动画定义
const expandAnimation = keyframes`
  from {
    max-height: 0;
    opacity: 0;
  }
  to {
    max-height: var(--content-height);
    opacity: 1;
  }
`

const collapseAnimation = keyframes`
  from {
    max-height: var(--content-height);
    opacity: 1;
  }
  to {
    max-height: 0;
    opacity: 0;
  }
`

// 样式组件
const SCxCollapseCard = styled.div<{ cardStyle?: CollapseProps["cardStyle"] }>`
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    border: 1px solid
        ${props => props.cardStyle?.borderColor || "var(--border-color)"};
    overflow: hidden;
    background: ${props =>
        props.cardStyle?.backgroundColor || "var(--bg-secondary)"};
    transition: all var(--transition-base);

    &:hover {
        box-shadow: var(--shadow-lg);
    }
`

const SCxHeader = styled.div<{ cardStyle?: CollapseProps["cardStyle"] }>`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    cursor: pointer;
    user-select: none;
    transition: all var(--transition-fast);
    min-height: 24px;

    &:hover {
        background-color: ${props =>
            props.cardStyle?.hoverBackgroundColor || "var(--gray-50)"};
    }
`

const SCxLeftSection = styled.div`
    display: flex;
    align-items: center;
    flex: 1;
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
`

const SCxRightSection = styled.div`
    display: flex;
    align-items: center;
    margin-left: var(--space-3);
`

const SCxContentWrapper = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "isOpen" && prop !== "animating"
})<{ isOpen: boolean; animating: boolean }>`
    overflow: hidden;
    max-height: 0;
    opacity: 0;

    ${props =>
        props.isOpen &&
        !props.animating &&
        css`
            max-height: none;
            opacity: 1;
        `}

    ${props =>
        props.animating &&
        css`
            animation: ${props.isOpen ? expandAnimation : collapseAnimation}
                0.3s ease forwards;
        `}
`

const SCxContent = styled.div`
    padding: 0 var(--space-5) var(--space-5);
    color: var(--text-secondary);
`

const SCxArrow = styled.span<{ isOpen: boolean }>`
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid var(--text-tertiary);
    margin-left: var(--space-2);
    transition: transform var(--transition-fast);
    transform: ${props => (props.isOpen ? "rotate(180deg)" : "rotate(0deg)")};
`

const SCxToggleLabel = styled.div`
    flex: 1;
    padding-right: var(--space-4);
`

const SCxToggleTitle = styled.div`
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    margin-bottom: var(--space-1);
`

const SCxToggleDescription = styled.div`
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: var(--line-height-normal);
`
// Collapse组件
const Collapse: React.FC<CollapseProps> = props => {
    const {
        leftSection,
        mode = "auto",
        title,
        children,
        style,
        defaultOpen,
        description,
        cardStyle,
        ...restProps
    } = props

    const { isOpen, toggle } = useCollapseState({
        open: restProps.open,
        defaultOpen,
        onChange: restProps.onChange
    })

    const contentRef = useRef<HTMLDivElement>(null)
    const [contentHeight, setContentHeight] = useState(0)
    const [isAnimating, setIsAnimating] = useState(false)

    // 计算内容高度
    useEffect(() => {
        if (contentRef.current) {
            setContentHeight(contentRef.current.scrollHeight)
        }
    }, [children, isOpen])

    // 处理动画状态
    useEffect(() => {
        if (isOpen !== undefined) {
            setIsAnimating(true)
            const timer = setTimeout(() => setIsAnimating(false), 300)
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    const handleHeaderClick = useCallback(
        (e: React.MouseEvent) => {
            // 如果点击的是开关，不触发toggle（因为开关有自己的点击处理）
            if (
                mode === "switch" &&
                (e.target as Element).closest(".collapse-switch")
            ) {
                return
            }
            toggle()
        },
        [mode, toggle]
    )

    const handleSwitchClick = useCallback(() => {
        toggle()
    }, [toggle])

    const renderRightSection = () => {
        if (mode === "switch") {
            return (
                <Switch
                    checked={isOpen}
                    onChange={handleSwitchClick}
                    className="collapse-switch"
                />
            )
        }

        return <SCxArrow isOpen={isOpen} />
    }

    return (
        <SCxCollapseCard style={style} cardStyle={cardStyle}>
            <SCxHeader onClick={handleHeaderClick} cardStyle={cardStyle}>
                <SCxLeftSection>
                    {leftSection || (
                        <SCxToggleLabel>
                            <SCxToggleTitle>{title}</SCxToggleTitle>
                            <SCxToggleDescription>
                                {description}
                            </SCxToggleDescription>
                        </SCxToggleLabel>
                    )}
                    {/* {renderTitle && renderTitle(isOpen)} */}
                </SCxLeftSection>
                <SCxRightSection>{renderRightSection()}</SCxRightSection>
            </SCxHeader>
            <SCxContentWrapper
                isOpen={isOpen}
                animating={isAnimating}
                style={
                    {
                        "--content-height": `${contentHeight}px`
                    } as React.CSSProperties
                }
            >
                <SCxContent ref={contentRef}>{children}</SCxContent>
            </SCxContentWrapper>
        </SCxCollapseCard>
    )
}

export default Collapse
