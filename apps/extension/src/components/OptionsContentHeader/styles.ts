import styled from "styled-components"

export const HeaderContainer = styled.header`
    margin-bottom: var(--space-6);
`

export const Masthead = styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin-bottom: var(--space-4);
`

export const Brand = styled.div`
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    min-width: 0;
`

export const BrandName = styled.h1`
    font-family: var(--font-display);
    font-size: var(--font-size-4xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    letter-spacing: 0.06em;
    line-height: var(--line-height-tight);
    margin: 0;
`

export const Version = styled.span`
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    letter-spacing: 0.02em;
    flex-shrink: 0;
`

export const Status = styled.div`
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`

// 一条轻薄蓝线，像信纸上的折痕
export const Seam = styled.div`
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
        border-radius: var(--radius-full);
    }
`
