export interface LoadingDotsProps {
    /** 是否显示加载动画 */
    loading?: boolean
    /** 地面阴影的颜色，默认为白色；小猫保持参考图的三花配色 */
    color?: string
    /** 保留原加载点的尺寸参数，用于计算小猫宽度 */
    size?: number
    /** 保留原加载点的间距参数，用于计算小猫宽度 */
    gap?: number
    /** 奔跑周期，默认为 0.72 秒 */
    duration?: number
}
