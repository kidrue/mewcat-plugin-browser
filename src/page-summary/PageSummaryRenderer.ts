import type { PageType } from "./pageTypes"

// cspell:ignore haspopup labelledby
const dismissedDocuments = new WeakSet<Document>()

export type PageSummaryRenderState =
    | { status: "loading" }
    | { status: "success"; summary: string; pageType: PageType }
    | { status: "empty" | "error" | "unavailable" }

export interface PageSummaryHandle {
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
    const style = document.createElement("style")
    style.textContent = `
        :host{all:initial;font:14px/1.7 system-ui,sans-serif;color:#1a1714}
        *{box-sizing:border-box}
        button{font:inherit;cursor:pointer}
        .launcher{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483646}
        .trigger{padding:8px 20px;border:1px solid #b9afa080;border-radius:24px;background:#fbf8f099;backdrop-filter:blur(12px);color:#5f4939;box-shadow:0 4px 18px #00000014}
        .dismiss{position:absolute;right:-8px;top:-10px;width:24px;height:24px;border:0;border-radius:50%;background:#fff;color:#dc2626;opacity:0;pointer-events:none;line-height:1}
        .launcher:hover .dismiss,.launcher:focus-within .dismiss{opacity:1;pointer-events:auto}
        button:focus-visible{outline:2px solid #b23a2e;outline-offset:3px}
        dialog{position:fixed;inset:0;margin:auto;width:min(560px,calc(100vw - 32px));max-height:80vh;overflow:auto;border:1px solid #d8cdbb;border-radius:16px;padding:24px;background:#fbf8f0;color:#1a1714;font:14px/1.7 system-ui,sans-serif;box-shadow:0 16px 60px #0003}
        dialog::backdrop{background:#0004}
        .close{float:right;border:0;background:transparent;color:#756b5e;font-size:22px}
        .label{font-size:18px;font-weight:600;color:#b23a2e;margin-bottom:12px}
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
    trigger.textContent = "页面总结"
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
    trigger.onclick = () => {
        if (!dialog.open) {
            dialog.showModal()
        }
    }
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
            unavailable: "未配置可用的生成式 AI 模型，页面总结暂不可用",
            error: "页面总结失败，请稍后重试"
        }
        content.textContent = messages[next.status]
    }

    update(state)
    return { update, remove: () => host.remove() }
}
