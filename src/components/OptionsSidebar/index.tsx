import React from "react"
import styled from "styled-components"

import BrandLogo from "../BrandLogo"

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

const SpineLogo = styled(BrandLogo)`
    box-shadow: 0 2px 8px rgba(79, 112, 190, 0.2);

    @media (max-width: 900px) {
        width: 34px;
        height: 34px;
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
    border-radius: var(--radius-md);
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
            border-radius: var(--radius-full);
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
            <SpineLogo size={40} />
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
