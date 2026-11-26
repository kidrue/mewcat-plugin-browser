import styled, { css } from "styled-components"

import type { SkyScene } from "@/components/SkyArtwork"
import { skyCardArtwork, SkyIllustratedIcon } from "@/components/SkyArtwork"

// 一个功能组对应一张纸面卡片，卡片内的字段仍用细线分隔。
export const Section = styled.section<{ $artwork?: SkyScene }>`
    min-width: 0;
    margin-bottom: var(--space-6);
    padding: var(--space-6);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    background-color: var(--bg-secondary);
    ${({ $artwork }) =>
        $artwork
            ? skyCardArtwork($artwork)
            : css`
                  background-image: linear-gradient(
                      135deg,
                      #ffffff 60%,
                      #f3f9ff
                  );
              `}
    box-shadow: var(--shadow-sm);

    &:last-child {
        margin-bottom: 0;
    }

    @media (max-width: 600px) {
        padding: var(--space-4);
    }
`

export const HeadingIcon = styled(SkyIllustratedIcon)`
    width: 52px;
    height: 52px;
    object-fit: contain;
    flex: none;
`

export const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
`

export const SectionTitle = styled.h3`
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

export const Heading = styled.div`
    flex: 1;
    min-width: 0;
`

export const Description = styled.p`
    margin: var(--space-2) 0 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
`

export const OptionsSectionNote = styled.p`
    margin: var(--space-4) 0 0;
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-light);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
`

export const RightSection = styled.div`
    max-width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
`

export const SectionContent = styled.div<{ layout?: string }>`
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

        /* 两列网格的首行不画分隔线，以保持两个字段顶部对齐。 */
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
