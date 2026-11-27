import { UI_FONT_FAMILY } from "@/constants/fonts"

import { PAGE_SUMMARY_UNAVAILABLE_MESSAGE } from "./availability"
import type { PageType } from "./pageTypes"

// cspell:ignore haspopup labelledby
const dismissedDocuments = new WeakSet<Document>()
export const PAGE_SUMMARY_DOCK_EVENT = "mewcat-page-summary-dock"

export type PageSummaryRenderState =
    | { status: "loading" }
    | { status: "success"; summary: string; pageType: PageType }
    | { status: "empty" | "error" | "unavailable" }

export interface PageSummaryHandle {
    open(): void
    update(state: PageSummaryRenderState): void
    remove(): void
}

export function renderPageSummary(
    _anchor: Element,
    state: PageSummaryRenderState
): PageSummaryHandle {
    const host = document.createElement("div")
    host.className = "mewcat-page-summary"
    host.setAttribute("data-mewcat-page-summary", "true")
    const shadow = host.attachShadow({ mode: "open" })
    document.documentElement.append(host)
    // 总结与翻译控制器是独立入口，兼容任意挂载顺序。
    const dock = () => {
        const slot = document
            .getElementById("translation-control-center-overlay")
            ?.shadowRoot?.querySelector("[data-mewcat-page-summary-slot]")
        if (slot) {
            slot.append(host)
            host.setAttribute("data-docked", "")
        }
    }
    document.addEventListener(PAGE_SUMMARY_DOCK_EVENT, dock)
    dock()
    host.addEventListener("click", event => event.stopPropagation())
    const style = document.createElement("style")
    style.textContent = `
        :host{all:initial;font:14px/1.7 ${UI_FONT_FAMILY};color:#1a1714}
        *{box-sizing:border-box}
        button{font:inherit;cursor:pointer}
        :host([data-docked]){visibility:inherit;pointer-events:inherit}
        .launcher{position:fixed;top:min(calc(50vh + 79px),calc(100vh - 38px));right:36px;width:30px;height:30px;z-index:2147483646}
        :host([data-docked]) .launcher{position:relative;top:auto;right:auto;z-index:auto}
        .trigger{display:flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--border-color,#cfe0ef);border-radius:var(--radius-md,8px);background:var(--bg-secondary,#fff);box-shadow:var(--shadow-sm,0 1px 2px #203b570f);color:var(--text-tertiary,#6f879c);transition:color 0.2s ease,border-color 0.2s ease,background 0.2s ease}
        .trigger:hover{background:var(--primary-light,#e8f4ff);border-color:var(--primary-color,#2878c8);color:var(--primary-color,#2878c8)}
        .trigger svg{width:16px;height:16px}
        @media(prefers-reduced-motion:reduce){.trigger{transition:none}}
        .dismiss{position:absolute;right:-6px;top:-6px;width:16px;height:16px;padding:0;border:0;border-radius:50%;background:#fff;color:#dc2626;opacity:0;pointer-events:none;font-size:12px;line-height:1}
        .launcher:hover .dismiss,.launcher:focus-within .dismiss{opacity:1;pointer-events:auto}
        button:focus-visible{outline:2px solid #2878c8;outline-offset:3px}
        dialog{position:fixed;visibility:visible;pointer-events:auto;inset:0;margin:auto;width:min(560px,calc(100vw - 32px));max-height:80vh;overflow:auto;border:1px solid #cfe0ef;border-radius:16px;padding:24px;background:#ffffff;color:#203b57;font:14px/1.7 ${UI_FONT_FAMILY};box-shadow:0 16px 60px #203b5733}
        dialog::backdrop{background:#0004}
        .close{float:right;border:0;background:transparent;color:#756b5e;font-size:22px}
        .label{font-size:18px;font-weight:600;color:#2878c8;margin-bottom:12px}
        .content{white-space:pre-wrap;overflow-wrap:anywhere}
        .meta{font-size:12px;color:#756b5e;margin-top:12px}
        [hidden]{display:none!important}
        @media(hover:none){.dismiss{opacity:1;pointer-events:auto}}
    `
    const launcher = document.createElement("div")
    launcher.className = "launcher"
    launcher.hidden = dismissedDocuments.has(document)
    const trigger = document.createElement("button")
    trigger.className = "trigger"
    trigger.type = "button"
    trigger.title = "页面总结"
    trigger.setAttribute("aria-label", "页面总结")
    trigger.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>'
    trigger.setAttribute("aria-haspopup", "dialog")
    const dismiss = document.createElement("button")
    dismiss.className = "dismiss"
    dismiss.textContent = "×"
    dismiss.setAttribute("aria-label", "暂时隐藏页面总结按钮")
    dismiss.title = "暂时隐藏，刷新页面后恢复"
    dismiss.onclick = () => {
        dismissedDocuments.add(document)
        launcher.hidden = true
    }
    launcher.append(trigger, dismiss)
    const dialog = document.createElement("dialog")
    dialog.setAttribute("aria-labelledby", "summary-title")
    const close = document.createElement("button")
    close.className = "close"
    close.textContent = "×"
    close.setAttribute("aria-label", "关闭页面总结")
    close.onclick = () => dialog.close()
    const open = () => {
        launcher.hidden = false
        if (!dialog.open) {
            dialog.showModal()
        }
    }
    trigger.onclick = open
    dialog.addEventListener("click", event => {
        if (event.target !== dialog) {
            return
        }
        const bounds = dialog.getBoundingClientRect()
        if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
        ) {
            dialog.close()
        }
    })
    const label = document.createElement("div")
    label.className = "label"
    label.id = "summary-title"
    label.textContent = "一句话总结"
    const content = document.createElement("div")
    content.className = "content"
    content.setAttribute("aria-live", "polite")
    const meta = document.createElement("div")
    meta.className = "meta"
    dialog.append(close, label, content, meta)
    shadow.append(style, launcher, dialog)

    const update = (next: PageSummaryRenderState) => {
        meta.textContent = ""
        if (next.status === "success") {
            content.textContent = next.summary
            meta.textContent = `页面类型：${next.pageType}`
            return
        }
        const messages = {
            loading: "正在总结页面内容…",
            empty: "页面内容不足，暂时无法总结",
            unavailable: PAGE_SUMMARY_UNAVAILABLE_MESSAGE,
            error: "页面总结失败，请稍后重试"
        }
        content.textContent = messages[next.status]
    }

    update(state)
    return {
        update,
        open,
        remove: () => {
            document.removeEventListener(PAGE_SUMMARY_DOCK_EVENT, dock)
            host.remove()
        }
    }
}
