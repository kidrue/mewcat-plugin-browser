import type React from "react"

export interface OptionsContentHeaderProps {
    /** 品牌名，用宋体大字排在报头左侧 */
    title: string
    /** 版本号，等宽小字 */
    version?: string
    /** 右侧常驻状态摘要，如「英语 → 简体中文 · DeepSeek」 */
    status?: React.ReactNode
    className?: string
}
