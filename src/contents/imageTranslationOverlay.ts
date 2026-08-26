import type {
    ImageTranslationResult,
    NormalizedImageBox
} from "@/messaging/protocol"

export interface Rect {
    left: number
    top: number
    width: number
    height: number
}

export interface ObjectFitLayoutInput {
    boxWidth: number
    boxHeight: number
    sourceWidth: number
    sourceHeight: number
    objectFit: string
    objectPosition: string
}

export interface OverlayDependencies {
    getComputedStyle?: (element: Element) => CSSStyleDeclaration
    requestAnimationFrame?: (callback: FrameRequestCallback) => number
    cancelAnimationFrame?: (handle: number) => void
    ResizeObserver?: typeof ResizeObserver
    MutationObserver?: typeof MutationObserver
    onDestroy?: () => void
}

export interface ImageTranslationOverlay {
    update(nextResult?: ImageTranslationResult): void
    destroy(): void
}

const px = (value: string | undefined) => Number.parseFloat(value || "0") || 0

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

interface PositionValue {
    kind: "percent" | "length"
    value: number
}

const parsePositionValue = (value: string | undefined): PositionValue => {
    const normalized = value?.trim().toLowerCase() || "center"
    if (normalized === "left" || normalized === "top") {
        return { kind: "percent", value: 0 }
    }
    if (normalized === "right" || normalized === "bottom") {
        return { kind: "percent", value: 1 }
    }
    if (normalized === "center") {
        return { kind: "percent", value: 0.5 }
    }
    if (normalized.endsWith("%")) {
        return {
            kind: "percent",
            value: (Number.parseFloat(normalized) || 0) / 100
        }
    }
    return { kind: "length", value: Number.parseFloat(normalized) || 0 }
}

const parseObjectPosition = (value: string): [PositionValue, PositionValue] => {
    const values = value.trim().split(/\s+/).filter(Boolean)
    if (values.length === 0) {
        return [parsePositionValue("center"), parsePositionValue("center")]
    }
    if (values.length === 1) {
        const only = values[0]
        if (only === "top" || only === "bottom") {
            return [parsePositionValue("center"), parsePositionValue(only)]
        }
        return [parsePositionValue(only), parsePositionValue("center")]
    }
    const [first, second] = values
    const firstVertical = first === "top" || first === "bottom"
    const secondHorizontal = second === "left" || second === "right"
    if (firstVertical || secondHorizontal) {
        return [parsePositionValue(second), parsePositionValue(first)]
    }
    return [parsePositionValue(first), parsePositionValue(second)]
}

const resolvePosition = (available: number, value: PositionValue): number =>
    (value.kind === "percent" ? available * value.value : value.value) || 0

export function getObjectFitContentRect(input: ObjectFitLayoutInput): Rect {
    const { boxWidth, boxHeight, sourceWidth, sourceHeight } = input
    if (
        boxWidth <= 0 ||
        boxHeight <= 0 ||
        sourceWidth <= 0 ||
        sourceHeight <= 0
    ) {
        return { left: 0, top: 0, width: 0, height: 0 }
    }

    const fit = input.objectFit || "fill"
    const containScale = Math.min(
        boxWidth / sourceWidth,
        boxHeight / sourceHeight
    )
    const coverScale = Math.max(
        boxWidth / sourceWidth,
        boxHeight / sourceHeight
    )
    let width = boxWidth
    let height = boxHeight

    if (fit === "contain") {
        width = sourceWidth * containScale
        height = sourceHeight * containScale
    }
    if (fit === "cover") {
        width = sourceWidth * coverScale
        height = sourceHeight * coverScale
    }
    if (fit === "none") {
        width = sourceWidth
        height = sourceHeight
    }
    if (fit === "scale-down") {
        const scale =
            sourceWidth <= boxWidth && sourceHeight <= boxHeight
                ? 1
                : containScale
        width = sourceWidth * scale
        height = sourceHeight * scale
    }

    const [horizontal, vertical] = parseObjectPosition(input.objectPosition)
    return {
        left: resolvePosition(boxWidth - width, horizontal),
        top: resolvePosition(boxHeight - height, vertical),
        width,
        height
    }
}

export function projectNormalizedBox(
    [ymin, xmin, ymax, xmax]: NormalizedImageBox,
    contentRect: Rect
): Rect {
    return {
        left: contentRect.left + (xmin / 1000) * contentRect.width,
        top: contentRect.top + (ymin / 1000) * contentRect.height,
        width: ((xmax - xmin) / 1000) * contentRect.width,
        height: ((ymax - ymin) / 1000) * contentRect.height
    }
}

export function isAxisAlignedTransform(transform: string | undefined): boolean {
    return analyzeTransform(transform).supported
}

interface TransformAnalysis {
    supported: boolean
    identity: boolean
}

const TRANSFORM_TOLERANCE = 0.00001

function analyzeTransform(transform: string | undefined): TransformAnalysis {
    const value = transform?.trim().toLowerCase() || "none"
    if (value === "none") {
        return { supported: true, identity: true }
    }
    const matrix = /^matrix\(([^)]+)\)$/.exec(value)
    if (matrix) {
        const numbers = matrix[1].split(",").map(Number)
        const supported =
            numbers.length === 6 &&
            numbers.every(Number.isFinite) &&
            numbers[0] > 0 &&
            numbers[3] > 0 &&
            Math.abs(numbers[1]) < TRANSFORM_TOLERANCE &&
            Math.abs(numbers[2]) < TRANSFORM_TOLERANCE
        return {
            supported,
            identity:
                supported &&
                Math.abs(numbers[0] - 1) < TRANSFORM_TOLERANCE &&
                Math.abs(numbers[3] - 1) < TRANSFORM_TOLERANCE &&
                Math.abs(numbers[4]) < TRANSFORM_TOLERANCE &&
                Math.abs(numbers[5]) < TRANSFORM_TOLERANCE
        }
    }
    const matrix3d = /^matrix3d\(([^)]+)\)$/.exec(value)
    if (!matrix3d) {
        return { supported: false, identity: false }
    }
    const values = matrix3d[1].split(",").map(Number)
    const supported =
        values.length === 16 &&
        values.every(Number.isFinite) &&
        values[0] > 0 &&
        values[5] > 0 &&
        values[10] > 0 &&
        Math.abs(values[1]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[2]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[3]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[4]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[6]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[7]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[8]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[9]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[11]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[14]) < TRANSFORM_TOLERANCE &&
        Math.abs(values[15] - 1) < TRANSFORM_TOLERANCE
    return {
        supported,
        identity:
            supported &&
            values.every(
                (entry, index) =>
                    Math.abs(entry - (index % 5 === 0 ? 1 : 0)) <
                    TRANSFORM_TOLERANCE
            )
    }
}

const parseNumericComponent = (
    value: string,
    allowLengthUnit: boolean
): number | null => {
    const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(.*)$/i.exec(
        value
    )
    if (!match) {
        return null
    }
    const numeric = Number(match[1])
    const unit = match[2].toLowerCase()
    if (!Number.isFinite(numeric)) {
        return null
    }
    if (!allowLengthUnit) {
        if (unit !== "" && unit !== "%") {
            return null
        }
        return unit === "%" ? numeric / 100 : numeric
    }
    if (
        unit === ""
            ? numeric !== 0
            : ![
                  "%",
                  "px",
                  "em",
                  "rem",
                  "ex",
                  "ch",
                  "cap",
                  "ic",
                  "lh",
                  "rlh",
                  "vw",
                  "vh",
                  "vi",
                  "vb",
                  "vmin",
                  "vmax",
                  "cm",
                  "mm",
                  "q",
                  "in",
                  "pt",
                  "pc"
              ].includes(unit)
    ) {
        return null
    }
    return numeric
}

function analyzeRotate(value: string | undefined): TransformAnalysis {
    const normalized = value?.trim().toLowerCase() || "none"
    if (normalized === "none") {
        return { supported: true, identity: true }
    }
    const parts = normalized.split(/\s+/)
    const angleMatch =
        /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)$/.exec(
            parts.at(-1) || ""
        )
    const axis = parts.slice(0, -1)
    const validAxis =
        axis.length === 0 ||
        (axis.length === 1 && ["x", "y", "z"].includes(axis[0])) ||
        (axis.length === 3 &&
            axis.every(component =>
                Number.isFinite(Number.parseFloat(component))
            ) &&
            axis.some(component => Math.abs(Number(component)) > 0))
    if (!angleMatch || !validAxis) {
        return { supported: false, identity: false }
    }
    const angle = Number(angleMatch[1])
    return {
        supported: Math.abs(angle) < TRANSFORM_TOLERANCE,
        identity: Math.abs(angle) < TRANSFORM_TOLERANCE
    }
}

function analyzeScale(value: string | undefined): TransformAnalysis {
    const normalized = value?.trim().toLowerCase() || "none"
    if (normalized === "none") {
        return { supported: true, identity: true }
    }
    const parts = normalized.split(/\s+/)
    const values = parts.map(part => parseNumericComponent(part, false))
    const supported =
        parts.length >= 1 &&
        parts.length <= 3 &&
        values.every(component => component !== null && component > 0)
    return {
        supported,
        identity:
            supported &&
            values.every(
                component =>
                    component !== null &&
                    Math.abs(component - 1) < TRANSFORM_TOLERANCE
            )
    }
}

function analyzeTranslate(value: string | undefined): TransformAnalysis {
    const normalized = value?.trim().toLowerCase() || "none"
    if (normalized === "none") {
        return { supported: true, identity: true }
    }
    const parts = normalized.split(/\s+/)
    const values = parts.map(part => parseNumericComponent(part, true))
    const supported =
        parts.length >= 1 &&
        parts.length <= 3 &&
        values.every(component => component !== null)
    return {
        supported,
        identity:
            supported &&
            values.every(
                component =>
                    component !== null &&
                    Math.abs(component) < TRANSFORM_TOLERANCE
            )
    }
}

export function hasSupportedTargetTransform(
    target: HTMLImageElement | HTMLCanvasElement,
    getStyle: (
        element: Element
    ) => CSSStyleDeclaration = window.getComputedStyle
): boolean {
    for (
        let element: Element | null = target;
        element;
        element = element.parentElement
    ) {
        const style = getStyle(element)
        const analyses = [
            analyzeTransform(style.transform),
            analyzeRotate(style.rotate),
            analyzeScale(style.scale),
            analyzeTranslate(style.translate)
        ]
        const perspective = style.perspective?.trim().toLowerCase() || "none"
        const rootBoundary =
            element === document.body || element === document.documentElement
        if (
            perspective !== "none" ||
            analyses.some(
                analysis =>
                    !analysis.supported || (rootBoundary && !analysis.identity)
            )
        ) {
            return false
        }
    }
    return true
}

export function getOverlayTextStyle(
    width: number,
    height: number,
    text: string,
    writingMode: "horizontal" | "vertical"
): { fontSize: number; writingMode: string } {
    const primary = writingMode === "vertical" ? height : width
    const secondary = writingMode === "vertical" ? width : height
    const characters = Math.max(1, Array.from(text).length)
    const estimate =
        writingMode === "vertical"
            ? Math.min(secondary * 0.72, primary / Math.ceil(characters / 2))
            : Math.min(
                  secondary * 0.72,
                  primary / Math.ceil(Math.sqrt(characters))
              )
    return {
        fontSize: Math.round(clamp(estimate, 10, 32) * 100) / 100,
        writingMode:
            writingMode === "vertical" ? "vertical-rl" : "horizontal-tb"
    }
}

function toRgba92(color: string): string {
    const rgb = color.match(
        /^\s*rgb\(\s*([\d.]+)[,\s]+\s*([\d.]+)[,\s]+\s*([\d.]+)\s*\)\s*$/i
    )
    if (rgb) {
        return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, 0.92)`
    }
    const hex = color.trim().replace("#", "")
    if (/^[\da-f]{6}$/i.test(hex)) {
        return `rgba(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)}, 0.92)`
    }
    return color.startsWith("rgba(")
        ? color.replace(/,[^,)]*\)$/, ", 0.92)")
        : color
}

function getTargetContentRect(
    target: HTMLImageElement | HTMLCanvasElement,
    result: ImageTranslationResult,
    style: CSSStyleDeclaration
): { viewport: Rect; object: Rect } {
    const bounds = target.getBoundingClientRect()
    const leftInset = px(style.borderLeftWidth) + px(style.paddingLeft)
    const topInset = px(style.borderTopWidth) + px(style.paddingTop)
    const rightInset = px(style.borderRightWidth) + px(style.paddingRight)
    const bottomInset = px(style.borderBottomWidth) + px(style.paddingBottom)
    const untransformedWidth = target.offsetWidth
    const untransformedHeight = target.offsetHeight
    if (untransformedWidth <= 0 || untransformedHeight <= 0) {
        return {
            viewport: {
                left: bounds.left,
                top: bounds.top,
                width: 0,
                height: 0
            },
            object: { left: 0, top: 0, width: 0, height: 0 }
        }
    }
    const scaleX = bounds.width / untransformedWidth
    const scaleY = bounds.height / untransformedHeight
    const contentWidth = Math.max(
        0,
        untransformedWidth - leftInset - rightInset
    )
    const contentHeight = Math.max(
        0,
        untransformedHeight - topInset - bottomInset
    )
    const viewport = {
        left: bounds.left + leftInset * scaleX,
        top: bounds.top + topInset * scaleY,
        width: contentWidth * scaleX,
        height: contentHeight * scaleY
    }
    const untransformedObject =
        target instanceof HTMLCanvasElement
            ? { left: 0, top: 0, width: contentWidth, height: contentHeight }
            : getObjectFitContentRect({
                  boxWidth: contentWidth,
                  boxHeight: contentHeight,
                  sourceWidth: result.sourceWidth,
                  sourceHeight: result.sourceHeight,
                  objectFit: style.objectFit || "fill",
                  objectPosition: style.objectPosition || "50% 50%"
              })
    return {
        viewport,
        object: {
            left: untransformedObject.left * scaleX,
            top: untransformedObject.top * scaleY,
            width: untransformedObject.width * scaleX,
            height: untransformedObject.height * scaleY
        }
    }
}

export function createImageTranslationOverlay(
    target: HTMLImageElement | HTMLCanvasElement,
    initialResult: ImageTranslationResult,
    deps: OverlayDependencies = {}
): ImageTranslationOverlay {
    const getStyle =
        deps.getComputedStyle || window.getComputedStyle.bind(window)
    const requestFrame =
        deps.requestAnimationFrame || window.requestAnimationFrame.bind(window)
    const cancelFrame =
        deps.cancelAnimationFrame || window.cancelAnimationFrame.bind(window)
    const ResizeObserverCtor = deps.ResizeObserver || window.ResizeObserver
    const MutationObserverCtor =
        deps.MutationObserver || window.MutationObserver
    const root = document.createElement("div")
    const targetId = `target-${Math.random().toString(36).slice(2, 10)}`
    root.setAttribute("data-mewcat-image-translation-overlay", "")
    root.setAttribute("data-mewcat-image-translation-target", targetId)
    Object.assign(root.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "2147483000",
        overflow: "hidden",
        display: "block"
    })
    ;(document.body || document.documentElement).append(root)

    let result = initialResult
    let destroyed = false
    let frame: number | null = null

    const render = () => {
        frame = null
        if (
            destroyed ||
            !target.isConnected ||
            !hasSupportedTargetTransform(target, getStyle)
        ) {
            destroy()
            return
        }
        const style = getStyle(target)
        const { viewport, object } = getTargetContentRect(target, result, style)
        if (
            viewport.width <= 0 ||
            viewport.height <= 0 ||
            object.width <= 0 ||
            object.height <= 0
        ) {
            root.style.display = "none"
            return
        }
        Object.assign(root.style, {
            display: "block",
            left: `${viewport.left}px`,
            top: `${viewport.top}px`,
            width: `${viewport.width}px`,
            height: `${viewport.height}px`,
            borderRadius: style.borderRadius || "6px"
        })
        root.replaceChildren(
            ...result.blocks.map(block => {
                const rect = projectNormalizedBox(block.box, object)
                const element = document.createElement("div")
                const textStyle = getOverlayTextStyle(
                    rect.width,
                    rect.height,
                    block.translatedText,
                    block.writingMode
                )
                element.setAttribute("data-mewcat-image-translation-block", "")
                element.textContent = block.translatedText
                Object.assign(element.style, {
                    position: "absolute",
                    left: `${rect.left}px`,
                    top: `${rect.top}px`,
                    width: `${Math.max(0, rect.width)}px`,
                    height: `${Math.max(0, rect.height)}px`,
                    boxSizing: "border-box",
                    padding: "2px 4px",
                    overflow: "hidden",
                    borderRadius: "6px",
                    backgroundColor: toRgba92(block.backgroundColor),
                    color: block.textColor,
                    fontSize: `${textStyle.fontSize}px`,
                    lineHeight: "1.2",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    writingMode: textStyle.writingMode,
                    textOrientation:
                        block.writingMode === "vertical" ? "mixed" : "initial"
                })
                return element
            })
        )
    }

    const scheduleRender = () => {
        if (!destroyed && frame === null) {
            frame = requestFrame(render)
        }
    }
    const onViewportChange = () => scheduleRender()
    const resizeObserver = ResizeObserverCtor
        ? new ResizeObserverCtor(scheduleRender)
        : null
    resizeObserver?.observe(target)
    const mutationObserver = MutationObserverCtor
        ? new MutationObserverCtor(records => {
              if (!target.isConnected) {
                  destroy()
                  return
              }
              const relevantChange = records.some(record => {
                  const changedElement = record.target
                  return (
                      changedElement instanceof Element &&
                      (changedElement === target ||
                          changedElement.contains(target))
                  )
              })
              if (relevantChange) {
                  if (!hasSupportedTargetTransform(target, getStyle)) {
                      destroy()
                  } else {
                      scheduleRender()
                  }
              }
          })
        : null
    mutationObserver?.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style"],
        childList: true,
        subtree: true
    })
    const isTargetOrAncestor = (eventTarget: EventTarget | null) =>
        eventTarget instanceof Element &&
        (eventTarget === target || eventTarget.contains(target))
    const onTransitionStart = (event: Event) => {
        const propertyName = (event as TransitionEvent).propertyName
        if (
            isTargetOrAncestor(event.target) &&
            [
                "transform",
                "rotate",
                "scale",
                "translate",
                "perspective"
            ].includes(propertyName)
        ) {
            destroy()
        }
    }
    const onAnimationStart = (event: Event) => {
        if (isTargetOrAncestor(event.target)) {
            destroy()
        }
    }
    window.addEventListener("scroll", onViewportChange, true)
    window.addEventListener("resize", onViewportChange)
    document.addEventListener("transitionrun", onTransitionStart, true)
    document.addEventListener("transitionstart", onTransitionStart, true)
    document.addEventListener("animationstart", onAnimationStart, true)
    if (target instanceof HTMLImageElement) {
        target.addEventListener("load", onViewportChange)
    }
    render()

    function destroy() {
        if (destroyed) {
            return
        }
        destroyed = true
        if (frame !== null) {
            cancelFrame(frame)
            frame = null
        }
        resizeObserver?.disconnect()
        mutationObserver?.disconnect()
        window.removeEventListener("scroll", onViewportChange, true)
        window.removeEventListener("resize", onViewportChange)
        document.removeEventListener("transitionrun", onTransitionStart, true)
        document.removeEventListener("transitionstart", onTransitionStart, true)
        document.removeEventListener("animationstart", onAnimationStart, true)
        if (target instanceof HTMLImageElement) {
            target.removeEventListener("load", onViewportChange)
        }
        root.remove()
        deps.onDestroy?.()
    }

    return {
        update(nextResult) {
            if (destroyed) {
                return
            }
            if (nextResult) {
                result = nextResult
            }
            scheduleRender()
        },
        destroy
    }
}
