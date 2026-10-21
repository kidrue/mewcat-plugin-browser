export const CANVAS_HOOK_CHANNEL = "mewcat-canvas-hook"
export const CANVAS_HOOK_VERSION = "1.0.0"

export type CanvasContextType =
    | "2d"
    | "webgl"
    | "webgl2"
    | "bitmaprenderer"
    | "offscreen-2d"
    | "offscreen-webgl"
    | "image-element"
    | "unknown"

export type CanvasRenderType = "canvas-2d" | "canvas-webgl" | "unknown"

export interface CanvasHookMeta {
    canvasId: string
    sourceUrl?: string
    width: number
    height: number
    sourceContextType: CanvasContextType
    targetContextType: CanvasContextType
    renderType: CanvasRenderType
    updatedAt: number
}

export interface CanvasHookError {
    requestId?: string
    code: string
    message: string
    hookStage:
        | "install"
        | "get-context"
        | "draw-image"
        | "query"
        | "response"
        | "unknown"
    stack?: string
    updatedAt: number
}

export interface CanvasMetaUpdateEvent {
    channel: typeof CANVAS_HOOK_CHANNEL
    type: "CANVAS_META_UPDATE"
    meta: CanvasHookMeta
}

export interface CanvasMetaQueryEvent {
    channel: typeof CANVAS_HOOK_CHANNEL
    type: "CANVAS_META_QUERY"
    requestId: string
    canvasId: string
}

export interface CanvasMetaResponseEvent {
    channel: typeof CANVAS_HOOK_CHANNEL
    type: "CANVAS_META_RESPONSE"
    requestId: string
    canvasId: string
    meta?: CanvasHookMeta
}

export interface CanvasMetaErrorEvent {
    channel: typeof CANVAS_HOOK_CHANNEL
    type: "CANVAS_META_ERROR"
    error: CanvasHookError
}

export type CanvasHookEvent =
    | CanvasMetaUpdateEvent
    | CanvasMetaQueryEvent
    | CanvasMetaResponseEvent
    | CanvasMetaErrorEvent
