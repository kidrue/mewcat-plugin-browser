export function installMewCatCanvasImageHook(channel: string, version: string) {
    const windowRef = window as Window & {
        __mewCatCanvasHookState__?: {
            version: string
            installed: boolean
        }
    }

    const postError = (
        code: string,
        message: string,
        hookStage:
            | "install"
            | "get-context"
            | "draw-image"
            | "query"
            | "response"
            | "unknown",
        requestId?: string,
        stack?: string
    ) => {
        window.postMessage(
            {
                channel,
                type: "CANVAS_META_ERROR",
                error: {
                    requestId,
                    code,
                    message,
                    hookStage,
                    stack,
                    updatedAt: Date.now()
                }
            },
            "*"
        )
    }

    try {
        if (
            windowRef.__mewCatCanvasHookState__?.installed &&
            windowRef.__mewCatCanvasHookState__?.version === version
        ) {
            return
        }
        windowRef.__mewCatCanvasHookState__ = {
            version,
            installed: true
        }

        type CanvasSurface = HTMLCanvasElement | OffscreenCanvas
        type CanvasMetaBase = {
            sourceUrl?: string
            width: number
            height: number
            sourceContextType: string
            targetContextType: string
            renderType: "canvas-2d" | "canvas-webgl" | "unknown"
            updatedAt: number
        }
        type CanvasMetaPayload = CanvasMetaBase & { canvasId: string }

        const sourceMetaMap = new WeakMap<CanvasSurface, CanvasMetaBase>()
        const contextTypeMap = new WeakMap<HTMLCanvasElement, string>()
        const offscreenContextTypeMap = new WeakMap<OffscreenCanvas, string>()
        let nextCanvasId = 1
        const hasOffscreenCanvas =
            typeof OffscreenCanvas !== "undefined" &&
            typeof OffscreenCanvas.prototype.getContext === "function"
        const hasOffscreen2dContext =
            typeof OffscreenCanvasRenderingContext2D !== "undefined"

        const normalizeContextType = (
            value: unknown,
            source: "html" | "offscreen"
        ): string => {
            if (typeof value !== "string") {
                return "unknown"
            }
            const normalized = value.toLowerCase().trim()
            if (normalized === "experimental-webgl") {
                return source === "offscreen" ? "offscreen-webgl" : "webgl"
            }
            if (
                normalized === "2d" ||
                normalized === "webgl" ||
                normalized === "webgl2" ||
                normalized === "bitmaprenderer"
            ) {
                if (source === "offscreen") {
                    if (normalized === "2d") {
                        return "offscreen-2d"
                    }
                    if (normalized === "webgl" || normalized === "webgl2") {
                        return "offscreen-webgl"
                    }
                    return "unknown"
                }
                return normalized
            }
            return "unknown"
        }

        const ensureCanvasId = (canvas: HTMLCanvasElement): string => {
            const existing = canvas.getAttribute("data-mewcat-canvas-id")
            if (existing) {
                return existing
            }
            const generated = `mewcat-canvas-${Date.now()}-${nextCanvasId}`
            nextCanvasId += 1
            canvas.setAttribute("data-mewcat-canvas-id", generated)
            return generated
        }

        const findCanvasById = (canvasId: string): HTMLCanvasElement | null => {
            const canvases = document.querySelectorAll("canvas")
            for (const canvas of canvases) {
                if (canvas.getAttribute("data-mewcat-canvas-id") === canvasId) {
                    return canvas
                }
            }
            return null
        }

        const resolveSourceUrl = (source: unknown): string | undefined => {
            if (source instanceof HTMLImageElement) {
                return source.currentSrc || source.src || undefined
            }
            if (source instanceof HTMLCanvasElement) {
                return sourceMetaMap.get(source)?.sourceUrl
            }
            if (hasOffscreenCanvas && source instanceof OffscreenCanvas) {
                return sourceMetaMap.get(source)?.sourceUrl
            }
            return undefined
        }

        const resolveSourceContextType = (source: unknown): string => {
            if (source instanceof HTMLCanvasElement) {
                return contextTypeMap.get(source) || "unknown"
            }
            if (hasOffscreenCanvas && source instanceof OffscreenCanvas) {
                return offscreenContextTypeMap.get(source) || "unknown"
            }
            if (source instanceof HTMLImageElement) {
                return "image-element"
            }
            return "unknown"
        }

        const resolveRenderType = (
            sourceContextType: string,
            targetContextType: string
        ): "canvas-2d" | "canvas-webgl" | "unknown" => {
            if (sourceContextType.includes("webgl")) {
                return "canvas-webgl"
            }
            if (targetContextType.includes("webgl")) {
                return "canvas-webgl"
            }
            if (targetContextType === "2d") {
                return "canvas-2d"
            }
            return "unknown"
        }

        const postMetaUpdate = (meta: CanvasMetaPayload) => {
            window.postMessage(
                {
                    channel,
                    type: "CANVAS_META_UPDATE",
                    meta
                },
                "*"
            )
        }

        const originalGetContext = HTMLCanvasElement.prototype.getContext
        const hookedGetContext = function (
            this: HTMLCanvasElement,
            contextType: string,
            ...args: unknown[]
        ) {
            const context = originalGetContext.call(
                this,
                contextType,
                ...(args as never[])
            )
            try {
                const normalized = normalizeContextType(contextType, "html")
                contextTypeMap.set(this, normalized)
                ensureCanvasId(this)
            } catch (error) {
                const err =
                    error instanceof Error ? error : new Error(String(error))
                postError(
                    "GET_CONTEXT_RECORD_FAILED",
                    err.message,
                    "get-context",
                    undefined,
                    err.stack
                )
            }
            return context
        }
        HTMLCanvasElement.prototype.getContext = hookedGetContext

        if (hasOffscreenCanvas) {
            const originalOffscreenGetContext =
                OffscreenCanvas.prototype.getContext
            const hookedOffscreenGetContext = function (
                this: OffscreenCanvas,
                contextType: string,
                ...args: unknown[]
            ) {
                const context = originalOffscreenGetContext.call(
                    this,
                    contextType,
                    ...(args as never[])
                )
                try {
                    const normalized = normalizeContextType(
                        contextType,
                        "offscreen"
                    )
                    offscreenContextTypeMap.set(this, normalized)
                } catch (error) {
                    const err =
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    postError(
                        "OFFSCREEN_GET_CONTEXT_RECORD_FAILED",
                        err.message,
                        "get-context",
                        undefined,
                        err.stack
                    )
                }
                return context
            }
            OffscreenCanvas.prototype.getContext = hookedOffscreenGetContext
        }

        const recordDrawImageMeta = (
            targetCanvas: CanvasSurface,
            source: unknown,
            fallbackContextType: string
        ) => {
            const targetContextType =
                targetCanvas instanceof HTMLCanvasElement
                    ? contextTypeMap.get(targetCanvas) || fallbackContextType
                    : offscreenContextTypeMap.get(targetCanvas) ||
                      fallbackContextType
            const sourceContextType = resolveSourceContextType(source)
            const baseMeta: CanvasMetaBase = {
                sourceUrl: resolveSourceUrl(source),
                width: targetCanvas.width,
                height: targetCanvas.height,
                sourceContextType,
                targetContextType,
                renderType: resolveRenderType(
                    sourceContextType,
                    targetContextType
                ),
                updatedAt: Date.now()
            }

            sourceMetaMap.set(targetCanvas, baseMeta)

            if (targetCanvas instanceof HTMLCanvasElement) {
                postMetaUpdate({
                    canvasId: ensureCanvasId(targetCanvas),
                    ...baseMeta
                })
            }
        }

        const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage
        const hookedDrawImage = function (
            this: CanvasRenderingContext2D,
            ...args: unknown[]
        ) {
            const result = originalDrawImage.apply(this, args as never[])

            try {
                const targetCanvas = this.canvas
                if (!targetCanvas) {
                    return result
                }
                recordDrawImageMeta(targetCanvas, args[0], "2d")
            } catch (error) {
                const err =
                    error instanceof Error ? error : new Error(String(error))
                postError(
                    "DRAW_IMAGE_HOOK_FAILED",
                    err.message,
                    "draw-image",
                    undefined,
                    err.stack
                )
            }

            return result
        } as CanvasRenderingContext2D["drawImage"]
        CanvasRenderingContext2D.prototype.drawImage = hookedDrawImage

        if (hasOffscreen2dContext) {
            const offscreenDrawImageProto =
                OffscreenCanvasRenderingContext2D.prototype
            const originalOffscreenDrawImage = offscreenDrawImageProto.drawImage
            const hookedOffscreenDrawImage = function (
                this: OffscreenCanvasRenderingContext2D,
                ...args: unknown[]
            ) {
                const result = originalOffscreenDrawImage.apply(
                    this,
                    args as never[]
                )

                try {
                    const targetCanvas = this.canvas
                    if (!targetCanvas) {
                        return result
                    }
                    recordDrawImageMeta(targetCanvas, args[0], "offscreen-2d")
                } catch (error) {
                    const err =
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    postError(
                        "OFFSCREEN_DRAW_IMAGE_HOOK_FAILED",
                        err.message,
                        "draw-image",
                        undefined,
                        err.stack
                    )
                }

                return result
            } as OffscreenCanvasRenderingContext2D["drawImage"]
            offscreenDrawImageProto.drawImage = hookedOffscreenDrawImage
        }

        const messageListener = (event: MessageEvent) => {
            const payload = event.data as
                | {
                      channel?: string
                      type?: string
                      requestId?: string
                      canvasId?: string
                  }
                | undefined

            if (event.source !== window) {
                return
            }
            if (!payload || payload.channel !== channel) {
                return
            }
            if (payload.type !== "CANVAS_META_QUERY") {
                return
            }

            try {
                const requestId = payload.requestId
                const canvasId = payload.canvasId
                if (!requestId || !canvasId) {
                    postError(
                        "CANVAS_META_QUERY_INVALID",
                        "requestId 或 canvasId 缺失",
                        "query",
                        requestId
                    )
                    return
                }

                const canvas = findCanvasById(canvasId)
                const rawMeta = canvas ? sourceMetaMap.get(canvas) : undefined
                const meta = rawMeta
                    ? {
                          canvasId,
                          ...rawMeta
                      }
                    : undefined

                window.postMessage(
                    {
                        channel,
                        type: "CANVAS_META_RESPONSE",
                        requestId,
                        canvasId,
                        meta
                    },
                    "*"
                )
            } catch (error) {
                const err =
                    error instanceof Error ? error : new Error(String(error))
                postError(
                    "CANVAS_META_QUERY_FAILED",
                    err.message,
                    "query",
                    payload?.requestId,
                    err.stack
                )
            }
        }

        window.addEventListener("message", messageListener)
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        postError(
            "CANVAS_HOOK_INSTALL_FAILED",
            err.message,
            "install",
            undefined,
            err.stack
        )
    }
}
