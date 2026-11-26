import React from "react"

import {
    BrandLockup,
    LockupInfo,
    LockupSubtitle,
    LockupTitle,
    NavDot,
    NavItem,
    NavList,
    SidebarContainer,
    SpineLogo
} from "./styles"
import type { OptionsSidebarProps } from "./types"

export const OptionsSidebar: React.FC<OptionsSidebarProps> = ({
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
