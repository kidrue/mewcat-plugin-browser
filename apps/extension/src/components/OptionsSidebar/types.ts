interface NavigationItem {
    id: string
    label: string
    description: string
}

export interface OptionsSidebarProps {
    title: string
    subtitle: string
    navigationItems: NavigationItem[]
    activeTab: string
    onTabChange: (tabId: string) => void
    className?: string
}
