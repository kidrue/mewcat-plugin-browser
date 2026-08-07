import React from "react"
import styled from "styled-components"

interface OptionsContentHeaderProps {
    /** 品牌名，用宋体大字排在报头左侧 */
    title: string
    /** 版本号，等宽小字 */
    version?: string
    /** 右侧常驻状态摘要，如「英语 → 简体中文 · DeepSeek」 */
    status?: React.ReactNode
    className?: string
}

const HeaderContainer = styled.header`
    margin-bottom: var(--space-7);
`

const Masthead = styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin-bottom: var(--space-4);
`

const Brand = styled.div`
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    min-width: 0;
`

const BrandName = styled.h1`
    font-family: var(--font-display);
    font-size: var(--font-size-4xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    letter-spacing: 0.1em;
    line-height: var(--line-height-tight);
    margin: 0;
`

const Version = styled.span`
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    letter-spacing: 0.02em;
    flex-shrink: 0;
`

const Status = styled.div`
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`

// 骑缝线：一条实线压着一枚朱砂方印
const Seam = styled.div`
    position: relative;
    height: 1px;
    background: var(--rule-strong);

    &::after {
        content: "";
        position: absolute;
        left: 0;
        top: -4px;
        width: 9px;
        height: 9px;
        background: var(--primary-color);
    }
`

const OptionsContentHeader: React.FC<OptionsContentHeaderProps> = ({
    title,
    version,
    status,
    className
}) => {
    return (
        <HeaderContainer className={className}>
            <Masthead>
                <Brand>
                    <BrandName>{title}</BrandName>
                    {version && <Version>{version}</Version>}
                </Brand>
                {status && <Status>{status}</Status>}
            </Masthead>
            <Seam aria-hidden="true" />
        </HeaderContainer>
    )
}

export default OptionsContentHeader
