import React from "react"
import styled from "styled-components"

interface SettingGroupProps {
    title: string
    description?: string
    children: React.ReactNode
    layout?: "vertical" | "horizontal" | "grid"
    className?: string
}

const SCxSettingGroup = styled.div`
    margin-bottom: var(--space-3);
    position: relative;
`

const SCxGroupHeader = styled.div<{ hasDescription?: boolean }>`
    margin-bottom: var(--space-2);
    padding-bottom: var(--space-2);
    border-bottom: ${props =>
        props.hasDescription ? "1px solid var(--border-light)" : "none"};
`

const SCxGroupTitle = styled.h4`
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin: 0 0 var(--space-1) 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;

    /* 紧凑的圆角指示器 */
    &::before {
        content: "";
        width: 4px;
        height: 4px;
        background: var(--primary-color);
        border-radius: var(--radius-sm);
        flex-shrink: 0;
    }
`

const SCxGroupDescription = styled.p`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    margin: 0;
    line-height: var(--line-height-normal);
`

const SCxGroupContent = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "layout"
})<{ layout?: string }>`
    display: ${props => {
        switch (props.layout) {
            case "horizontal":
                return "flex"
            case "grid":
                return "grid"
            default:
                return "block"
        }
    }};

    ${props =>
        props.layout === "horizontal" &&
        `
        gap: var(--space-4);
        align-items: flex-start;
        
        > * {
            flex: 1;
        }
    `}

    ${props =>
        props.layout === "grid" &&
        `
        grid-template-columns: 1fr 1fr;
        gap: var(--space-4);
        
        @media (max-width: 768px) {
            grid-template-columns: 1fr;
            gap: var(--space-3);
        }
    `}
`

const SettingGroup: React.FC<SettingGroupProps> = ({
    title,
    description,
    children,
    layout = "vertical",
    className
}) => {
    return (
        <SCxSettingGroup className={className}>
            <SCxGroupHeader hasDescription={!!description}>
                <SCxGroupTitle>{title}</SCxGroupTitle>
                {description && (
                    <SCxGroupDescription>{description}</SCxGroupDescription>
                )}
            </SCxGroupHeader>
            <SCxGroupContent layout={layout}>{children}</SCxGroupContent>
        </SCxSettingGroup>
    )
}

export default SettingGroup
