import type { ExtensionConfig } from "./config"

export enum ExtensionMessageEnumType {
    TOGGLE_ACTIVATED = "TOGGLE_ACTIVATED"
}

/**
 * 扩展内部消息类型定义
 * 用于popup、content、background等组件间的通信
 */

export interface ExtensionMessage {
    type: ExtensionMessageEnumType
    data?: Partial<ExtensionConfig>
    timestamp?: number
}
