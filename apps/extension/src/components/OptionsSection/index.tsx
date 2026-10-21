import React from "react"
import styled from "styled-components"

import {
    getSkySceneUrl,
    SkyIllustratedIcon,
    type SkyIllustration,
    type SkyScene
} from "@/components/SkyArtwork"

interface OptionsSectionProps {
    title: string
    description?: string
    artwork?: SkyScene
    icon?: SkyIllustration
    rightSection?: React.ReactNode
    layout?: "default" | "grid" | "horizontal"
    children: React.ReactNode
    className?: string
}

// 一个功能组对应一张纸面卡片，卡片内的字段仍用细线分隔。
const Section = styled.section<{ $artwork?: SkyScene }>`
    min-width: 0;
    margin-bottom: var(--space-6);
    padding: var(--space-6);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    background-color: var(--bg-secondary);
    background-image: ${props =>
        props.$artwork
            ? `linear-gradient(105deg, rgba(255,255,255,0.98) 15%, rgba(255,255,255,0.95) 55%, rgba(255,255,255,0.82)), url("${getSkySceneUrl(props.$artwork)}")`
            : "linear-gradient(135deg, #ffffff 60%, #f3f9ff)"};
    background-size: cover;
    background-position: right center;
    box-shadow: var(--shadow-sm);

    &:last-child {
        margin-bottom: 0;
    }

    @media (max-width: 600px) {
        padding: var(--space-4);
    }
`

const HeadingIcon = styled(SkyIllustratedIcon)`
    width: 52px;
    height: 52px;
    object-fit: contain;
    flex: none;
`

const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
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
    min-width: 0;
    overflow-wrap: anywhere;

    /* 小圆点像邮戳，提示阅读起点 */
    &::before {
        content: "";
        width: 7px;
        height: 7px;
        background: var(--primary-color);
        border-radius: var(--radius-full);
        flex-shrink: 0;
    }
`

const Heading = styled.div`
    flex: 1;
    min-width: 0;
`

const Description = styled.p`
    margin: var(--space-2) 0 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
`

const RightSection = styled.div`
    max-width: 100%;
    display: flex;
    flex-wrap: wrap;
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
            min-width: 0;
        }

        @media (max-width: 900px) {
            flex-direction: column;
            gap: var(--space-3);

            > * {
                width: 100%;
            }
        }
    `}
`

const OptionsSection: React.FC<OptionsSectionProps> = ({
    title,
    description,
    artwork,
    icon,
    rightSection,
    layout = "default",
    children,
    className
}) => {
    const titleId = React.useId()
    return (
        <Section
            className={className}
            aria-labelledby={titleId}
            $artwork={artwork}
        >
            <SectionHeader>
                {icon && <HeadingIcon kind={icon} />}
                <Heading>
                    <SectionTitle id={titleId}>{title}</SectionTitle>
                    {description && <Description>{description}</Description>}
                </Heading>
                {rightSection && <RightSection>{rightSection}</RightSection>}
            </SectionHeader>
            <SectionContent layout={layout}>{children}</SectionContent>
        </Section>
    )
}

export default OptionsSection
