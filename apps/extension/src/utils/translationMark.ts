import type { CSSProperties } from "react"

export type TranslationMarkPlacement =
    | "inline"
    | "corner"
    | "border-corner"
    | "plain"

// 暂时统一隐藏所有译文角标，保留原有节点与摆放方式以便后续恢复。
export const SHOW_TRANSLATION_MARK = false

const markTemplates = new WeakMap<
    Document,
    Map<TranslationMarkPlacement, SVGSVGElement>
>()

// 猫耳与信封折线共用同一份轻量矢量定义，不加载图片或字体。
export const TRANSLATION_MARK_PATHS = [
    { d: "M5 12V3l5 3h4l5-3v9", fill: "#f5faff" },
    {
        d: "M4 11h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Zm-1 1 9 6 9-6",
        fill: "#e2f1ff"
    },
    { d: "M9 9h.01M15 9h.01", fill: "none" }
] as const

export const TRANSLATION_MARK_PATH_STYLE: CSSProperties = {
    stroke: "#2878c8",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round"
}

export function getTranslationMarkStyle(
    placement: TranslationMarkPlacement = "inline"
): CSSProperties {
    return {
        display: SHOW_TRANSLATION_MARK ? "inline-block" : "none",
        width: "14px",
        height: "14px",
        flexShrink: 0,
        boxSizing: "content-box",
        padding: 0,
        margin: 0,
        border: "none",
        overflow: "visible",
        pointerEvents: "none",
        userSelect: "none",
        verticalAlign: "-0.12em",
        ...(placement === "corner" || placement === "border-corner"
            ? {
                  position: "absolute",
                  right: placement === "border-corner" ? "-7px" : "4px",
                  bottom: placement === "border-corner" ? "-7px" : "4px"
              }
            : placement === "inline"
              ? { marginLeft: "0.35em", maxWidth: "1em", maxHeight: "1em" }
              : {})
    }
}

export function createTranslationMark(
    placement: TranslationMarkPlacement = "inline",
    ownerDocument: Document = document
): SVGSVGElement {
    const cloneMark = (template: SVGSVGElement) => {
        const clone = template.cloneNode(true) as SVGSVGElement
        if (!SHOW_TRANSLATION_MARK) {
            clone.style.setProperty("display", "none", "important")
        }
        return clone
    }
    let templates = markTemplates.get(ownerDocument)
    if (!templates) {
        templates = new Map()
        markTemplates.set(ownerDocument, templates)
    }
    const template = templates.get(placement)
    if (template) {
        return cloneMark(template)
    }
    const svg = ownerDocument.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
    )
    svg.setAttribute("viewBox", "0 0 24 24")
    svg.setAttribute("class", "mewcat-translation-mark")
    svg.setAttribute("aria-hidden", "true")
    svg.setAttribute("focusable", "false")
    Object.assign(svg.style, getTranslationMarkStyle(placement))
    if (!SHOW_TRANSLATION_MARK) {
        svg.style.setProperty("display", "none", "important")
    }
    for (const { d, fill } of TRANSLATION_MARK_PATHS) {
        const path = ownerDocument.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        )
        path.setAttribute("d", d)
        Object.assign(path.style, TRANSLATION_MARK_PATH_STYLE, { fill })
        svg.append(path)
    }
    // 每个文档、每种摆放方式只构造一次样式与路径，长页面直接克隆模板。
    templates.set(placement, svg)
    return cloneMark(svg)
}
