import React from "react"
import styled from "styled-components"

interface NavigationItem {
    id: string
    label: string
    description: string
}

interface OptionsSidebarProps {
    title: string
    subtitle: string
    navigationItems: NavigationItem[]
    activeTab: string
    onTabChange: (tabId: string) => void
    className?: string
}

// 书脊：竖排目录。窄屏降级为横排 tab 条。
const SidebarContainer = styled.aside`
    width: 76px;
    height: 100%;
    flex-shrink: 0;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-5) 0;
    gap: var(--space-4);

    @media (max-width: 900px) {
        width: 100%;
        height: auto;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        overflow-x: auto;
        padding: var(--space-2) var(--space-4);
        gap: var(--space-3);
        border-right: none;
        border-bottom: 1px solid var(--border-color);
    }
`

// 朱砂印 logo —— 与页面内悬浮球同形制
const SpineSeal = styled.div`
    width: 40px;
    height: 40px;
    flex: none;
    border-radius: 6px;
    background: var(--primary-color);
    color: var(--text-inverse);
    font-family: var(--font-display);
    font-size: 21px;
    font-weight: var(--font-weight-semibold);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 0 0 1.5px rgba(251, 248, 240, 0.55);
    user-select: none;

    @media (max-width: 900px) {
        width: 34px;
        height: 34px;
        font-size: 18px;
    }
`

const NavList = styled.nav`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    width: 100%;

    @media (max-width: 900px) {
        flex-direction: row;
        width: auto;
    }
`

const NavItem = styled.button<{ $active: boolean }>`
    writing-mode: vertical-rl;
    appearance: none;
    border: none;
    background: none;
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.22em;
    color: ${props =>
        props.$active ? "var(--primary-color)" : "var(--text-tertiary)"};
    padding: var(--space-4) var(--space-2) var(--space-4) var(--space-3);
    cursor: pointer;
    position: relative;
    border-radius: var(--radius-sm);
    transition:
        color var(--transition-fast),
        background var(--transition-fast);

    &:hover {
        color: ${props =>
            props.$active ? "var(--primary-color)" : "var(--text-primary)"};
        background: ${props =>
            props.$active ? "transparent" : "var(--bg-tertiary)"};
    }

    /* 当前项：书脊上的一道朱砂 */
    ${props =>
        props.$active &&
        `
        &::after {
            content: "";
            position: absolute;
            right: 2px;
            top: 12%;
            bottom: 12%;
            width: 3px;
            background: var(--primary-color);
        }
    `}

    @media (max-width: 900px) {
        writing-mode: horizontal-tb;
        white-space: nowrap;
        padding: var(--space-2) var(--space-3);
        font-size: var(--font-size-base);
        letter-spacing: 0.1em;

        ${props =>
            props.$active &&
            `
            &::after {
                right: var(--space-2);
                left: var(--space-2);
                top: auto;
                bottom: 2px;
                width: auto;
                height: 2px;
            }
        `}
    }
`

const OptionsSidebar: React.FC<OptionsSidebarProps> = ({
    title,
    navigationItems,
    activeTab,
    onTabChange,
    className
}) => {
    return (
        <SidebarContainer className={className}>
            <SpineSeal aria-hidden="true">譯</SpineSeal>
            <NavList role="tablist" aria-label={title}>
                {navigationItems.map(item => (
                    <NavItem
                        key={item.id}
                        role="tab"
                        aria-selected={activeTab === item.id}
                        $active={activeTab === item.id}
                        onClick={() => onTabChange(item.id)}
                    >
                        {item.label}
                    </NavItem>
                ))}
            </NavList>
        </SidebarContainer>
    )
}

export default OptionsSidebar
