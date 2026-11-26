import type { PageActionExecutor } from "@/features/reading/pageActions"

export interface SettingsPanelProps {
    executePageAction?: PageActionExecutor
    currentTabUrl?: URL
    /** floating = 悬浮球纸面面板；embedded = popup 插画背景与设置卡片 */
    variant?: "floating" | "embedded"
}
