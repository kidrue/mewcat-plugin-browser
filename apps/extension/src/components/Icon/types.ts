import type React from "react"

import type { iconMap } from "./constants"

export interface IconProps {
    name: string
    size?: number | string
    color?: string
    className?: string
    style?: React.CSSProperties
    onClick?: () => void
}

// 导出可用的图标名称，用于TypeScript类型检查
export type IconName = keyof typeof iconMap
