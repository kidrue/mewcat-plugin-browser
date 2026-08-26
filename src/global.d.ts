declare global {
    /** 扩展调试对象 - 运行时注入 */
    interface Window {
        immersiveTranslatorDebug?: {
            highlightNode: (index: number) => void
            closePanel: () => void
            togglePanel: () => void
            exportDebugData: () => void
            showRulesInfo: () => void
            showNodesInfo: () => void
        }
        debugExample?: {
            basic: () => void
            advanced: () => void
            help: () => void
        }
    }
}

// 声明所有图片文件类型
declare module "*.png" {
    const src: string
    export default src
}

declare module "*.jpg" {
    const src: string
    export default src
}

declare module "*.jpeg" {
    const src: string
    export default src
}

declare module "*.svg" {
    const src: string
    export default src
}
