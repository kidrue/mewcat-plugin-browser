import React from "react"
import styled from "styled-components"

interface OptionsSectionProps {
    title: string
    rightSection?: React.ReactNode
    layout?: "default" | "grid" | "horizontal"
    children: React.ReactNode
    className?: string
}

// 分节不是卡片：没有背景、没有外框、没有 hover。
// 层级完全由「朱砂方块 + 宋体标题 + 向右延伸的 hairline」建立。
const Section = styled.section`
    margin-bottom: var(--space-8);

    &:last-child {
        margin-bottom: 0;
    }
`

const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
`

const SectionTitle = styled.h3`
    font-family: var(--font-display);
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    letter-spacing: 0.04em;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0;
    flex-shrink: 0;

    /* 圆角标记：与全局柔和的容器语言保持一致 */
    &::before {
        content: "";
        width: 7px;
        height: 7px;
        background: var(--primary-color);
        border-radius: var(--radius-sm);
        flex-shrink: 0;
    }
`

// 标题右侧一直延伸到尽头的细线
const Lead = styled.span`
    flex: 1;
    height: 1px;
    background: var(--border-color);
    min-width: var(--space-4);
`

const RightSection = styled.div`
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
`

const SectionContent = styled.div<{ layout?: string }>`
    display: ${props => {
        switch (props.layout) {
            case "grid":
                return "grid"
            case "horizontal":
                return "flex"
            default:
                return "block"
        }
    }};

    ${props =>
        props.layout === "grid" &&
        `
        grid-template-columns: 1fr 1fr;
        column-gap: var(--space-8);

        /* grid item 默认 min-width:auto，内容宽就撑破列 —— 必须显式放开 */
        > * {
            min-width: 0;
        }

        /* FormRow 的分隔线按「纵向堆叠」设计，只有 DOM 第一个不画线。
           两列网格下第二个也在首行，同样不该画 —— 否则两列会错开一行的高度。 */
        && > *:nth-child(-n + 2) {
            border-top: none;
            padding-top: 0;
        }

        @media (max-width: 900px) {
            grid-template-columns: 1fr;

            && > *:nth-child(2) {
                border-top: 1px solid var(--border-light);
                padding-top: var(--space-4);
            }
        }
    `}

    ${props =>
        props.layout === "horizontal" &&
        `
        gap: var(--space-4);
        align-items: flex-start;

        > * {
            flex: 1;
        }

        @media (max-width: 900px) {
            flex-direction: column;
            gap: var(--space-3);
        }
    `}
`

const OptionsSection: React.FC<OptionsSectionProps> = ({
    title,
    rightSection,
    layout = "default",
    children,
    className
}) => {
    return (
        <Section className={className}>
            <SectionHeader>
                <SectionTitle>{title}</SectionTitle>
                <Lead aria-hidden="true" />
                {rightSection && <RightSection>{rightSection}</RightSection>}
            </SectionHeader>
            <SectionContent layout={layout}>{children}</SectionContent>
        </Section>
    )
}

export default OptionsSection
