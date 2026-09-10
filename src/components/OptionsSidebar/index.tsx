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

const SidebarContainer = styled.aside`
    width: 232px;
    height: 100%;
    flex-shrink: 0;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    padding: var(--space-8) var(--space-4);
    gap: var(--space-8);

    @media (max-width: 900px) {
        width: 100%;
        height: auto;
        flex-direction: column;
        align-items: center;
        overflow-x: auto;
        padding: var(--space-3) var(--space-4) 0;
        gap: var(--space-3);
        border-right: none;
        border-bottom: 1px solid var(--border-color);
    }
`

const BrandLockup = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--space-2);
`

const LockupInfo = styled.div`
    min-width: 0;
`

const LockupTitle = styled.div`
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.08em;
    line-height: var(--line-height-tight);
`

const LockupSubtitle = styled.div`
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    letter-spacing: 0.06em;
    margin-top: var(--space-1);
`

const SpineLogo = styled(BrandLogo)`
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-primary-sm);
`

const NavList = styled.nav`
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;

    @media (max-width: 900px) {
        flex-direction: row;
        width: auto;
        max-width: 100%;
        overflow-x: auto;
        padding: 0 var(--space-1);
    }
`

const NavItem = styled.button<{ $active: boolean }>`
    appearance: none;
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    border: 1px solid transparent;
    border-left: 3px solid
        ${props => (props.$active ? "var(--primary-color)" : "transparent")};
    background: ${props =>
        props.$active ? "var(--primary-light)" : "transparent"};
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    font-weight: ${props =>
        props.$active
            ? "var(--font-weight-semibold)"
            : "var(--font-weight-medium)"};
    color: ${props =>
        props.$active ? "var(--primary-color)" : "var(--text-tertiary)"};
    text-align: left;
    padding: var(--space-3) var(--space-3);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition:
        color var(--transition-fast),
        background var(--transition-fast),
        border-color var(--transition-fast);

    &:hover {
        color: ${props =>
            props.$active ? "var(--primary-color)" : "var(--text-primary)"};
        background: ${props =>
            props.$active ? "var(--primary-light)" : "var(--bg-tertiary)"};
    }

    @media (max-width: 900px) {
        width: auto;
        white-space: nowrap;
        padding: var(--space-2) var(--space-3);
        font-size: var(--font-size-base);
        letter-spacing: 0.1em;
        border-left: 0;
        border-bottom: 2px solid
            ${props => (props.$active ? "var(--primary-color)" : "transparent")};
    }
`

const NavDot = styled.span<{ $active: boolean }>`
    width: 7px;
    height: 7px;
    flex: none;
    border-radius: var(--radius-full);
    background: ${props =>
        props.$active ? "var(--primary-color)" : "var(--sky-line)"};
    box-shadow: ${props =>
        props.$active ? "0 0 0 3px var(--seal-ring)" : "none"};
`

const OptionsSidebar: React.FC<OptionsSidebarProps> = ({
    title,
    subtitle,
    navigationItems,
    activeTab,
    onTabChange,
    className
}) => {
    return (
        <SidebarContainer className={className}>
            <BrandLockup>
                <SpineLogo size={42} />
                <LockupInfo>
                    <LockupTitle>{title}</LockupTitle>
                    <LockupSubtitle>{subtitle}</LockupSubtitle>
                </LockupInfo>
            </BrandLockup>
            <NavList role="tablist" aria-label={title}>
                {navigationItems.map(item => (
                    <NavItem
                        key={item.id}
                        role="tab"
                        aria-selected={activeTab === item.id}
                        $active={activeTab === item.id}
                        onClick={() => onTabChange(item.id)}
                    >
                        <NavDot
                            $active={activeTab === item.id}
                            aria-hidden="true"
                        />
                        {item.label}
                    </NavItem>
                ))}
            </NavList>
        </SidebarContainer>
    )
}

export default OptionsSidebar
