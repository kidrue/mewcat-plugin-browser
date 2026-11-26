export interface ImageTranslateButtonProps {
    /** 是否显示 */
    visible: boolean
    /** 是否正在翻译 */
    translating: boolean
    /** 点击事件 */
    onClick: () => void
    /** 按钮位置 */
    position: { x: number; y: number }
    /** 鼠标进入按钮 */
    onMouseEnter?: () => void
    /** 鼠标离开按钮 */
    onMouseLeave?: () => void
}
