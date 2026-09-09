import type { PageType } from "./pageTypes"

export type PageSummaryRenderState =
    | { status: "loading" }
    | { status: "success"; summary: string; pageType: PageType }
    | { status: "empty" | "error" | "unavailable" }

export interface PageSummaryHandle {
    update(state: PageSummaryRenderState): void
    remove(): void
}

export function renderPageSummary(
    anchor: Element,
    state: PageSummaryRenderState
): PageSummaryHandle {
    const host = document.createElement("div")
    host.className = "mewcat-page-summary"
    host.setAttribute("data-mewcat-page-summary", "true")
    const shadow = host.attachShadow({ mode: "open" })
    anchor.insertAdjacentElement("afterend", host)

    const update = (next: PageSummaryRenderState) => {
        shadow.replaceChildren()
        const style = document.createElement("style")
        style.textContent = `:host{display:block;margin:24px 0;font:14px/1.7 system-ui,sans-serif;color:#1a1714}.card{border:1px solid #d8cdbb;padding:16px;background:#fbf8f0}.label{font-weight:600;color:#b23a2e;margin-bottom:6px}.meta{font-size:12px;color:#756b5e;margin-top:8px}`
        shadow.append(style)
        const card = document.createElement("section")
        card.className = "card"
        const label = document.createElement("div")
        label.className = "label"
        label.textContent = "一句话总结"
        card.append(label)
        const content = document.createElement("div")
        if (next.status === "loading") content.textContent = "正在总结页面内容…"
        else if (next.status === "success") {
            content.textContent = next.summary
            const meta = document.createElement("div")
            meta.className = "meta"
            meta.textContent = `页面类型：${next.pageType}`
            card.append(content, meta)
            shadow.append(card)
            return
        } else if (next.status === "empty")
            content.textContent = "页面内容不足，暂时无法总结"
        else if (next.status === "unavailable")
            content.textContent = "未配置可用的生成式 AI 模型，页面总结暂不可用"
        else content.textContent = "页面总结失败，请稍后重试"
        card.append(content)
        shadow.append(card)
    }

    update(state)
    return { update, remove: () => host.remove() }
}
