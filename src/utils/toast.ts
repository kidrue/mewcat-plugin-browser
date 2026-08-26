import { createRoot } from "react-dom/client"

export enum ToastType {
    SUCCESS = "success",
    ERROR = "error",
    INFO = "info",
    WARNING = "warning"
}

interface ToastOptions {
    type?: ToastType
    message: string | React.ReactNode
    duration?: number
}

export class ToastController {
    private static instance: ToastController
    private container: HTMLDivElement | null = null
    private timeoutId: number | null = null
    private currentToast: HTMLElement | null = null

    private constructor() {
        this.createContainer()
    }

    public static getInstance(): ToastController {
        if (!ToastController.instance) {
            ToastController.instance = new ToastController()
        }
        return ToastController.instance
    }

    private createContainer() {
        if (this.container) {
            return
        }
        this.container = document.createElement("div")
        this.container.id = "side-translate-toast-container"
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            max-width: 90vw;
            width: auto;
            height: auto;
            min-height: 60px;
        `
        document.body.appendChild(this.container)
    }

    public show({
        type = ToastType.INFO,
        message,
        duration = 3000
    }: ToastOptions) {
        if (!this.container) {
            this.createContainer()
        }

        // 如果有正在显示的toast，先隐藏它
        if (this.currentToast) {
            this.hideToast(this.currentToast)
        }

        // 清除之前的定时器
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
            this.timeoutId = null
        }

        // 创建toast元素
        const toast = document.createElement("div")
        toast.className = `side-translate-toast side-translate-toast-${type}`

        // 创建图标
        const icon = document.createElement("span")
        icon.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-right: 8px;
            flex-shrink: 0;
        `
        icon.innerHTML = this.getIconSvg(type)

        // 创建文本
        const textSpan = document.createElement("span")
        if (typeof message === "string") {
            textSpan.textContent = message
        } else {
            const root = createRoot(textSpan)
            // 渲染内容（message 需为 ReactNode 类型）
            root.render(message as React.ReactNode)
        }
        textSpan.style.cssText = `
            flex: 1;
            font-size: 14px;
            line-height: 1.4;
        `

        toast.appendChild(icon)
        toast.appendChild(textSpan)

        // 设置样式
        toast.style.cssText = `
            display: flex;
            align-items: center;
            min-width: 240px;
            max-width: 420px;
            padding: 12px 16px;
            border-radius: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: 500;
            color: #fff;
            background: ${this.getBgColor(type)};
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: auto;
            cursor: pointer;
            user-select: none;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
        `

        this.container!.appendChild(toast)
        this.currentToast = toast

        // 添加点击关闭功能
        toast.addEventListener("click", () => {
            this.hideToast(toast)
        })

        // 动画显示
        requestAnimationFrame(() => {
            toast.style.opacity = "1"
            toast.style.transform = "translateX(-50%) translateY(0)"
        })

        // 自动关闭
        this.timeoutId = window.setTimeout(() => {
            this.hideToast(toast)
        }, duration)
    }

    private hideToast(toast: HTMLElement) {
        // 如果这不是当前的toast，直接返回
        if (toast !== this.currentToast) {
            return
        }

        toast.style.opacity = "0"
        toast.style.transform = "translateX(-50%) translateY(-20px)"
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast)
            }
            // 如果隐藏的是当前toast，清空引用
            if (toast === this.currentToast) {
                this.currentToast = null
            }
        }, 300)
    }

    private getBgColor(type: ToastType): string {
        switch (type) {
            case ToastType.SUCCESS:
                return "#22c55e" // 绿色
            case ToastType.ERROR:
                return "#ef4444" // 红色
            case ToastType.INFO:
                return "#3b82f6" // 蓝色
            case ToastType.WARNING:
                return "#f59e0b" // 橙色
            default:
                return "#3b82f6" // 默认蓝色
        }
    }

    private getIconSvg(type: ToastType): string {
        const iconSize = "16"
        switch (type) {
            case ToastType.SUCCESS:
                return `<svg width="${iconSize}" height="${iconSize}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`
            case ToastType.ERROR:
                return `<svg width="${iconSize}" height="${iconSize}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`
            case ToastType.INFO:
                return `<svg width="${iconSize}" height="${iconSize}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
            case ToastType.WARNING:
                return `<svg width="${iconSize}" height="${iconSize}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>`
            default:
                return ""
        }
    }
}

export const Toast = ToastController.getInstance()
