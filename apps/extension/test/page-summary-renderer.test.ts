// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"

import { renderPageSummary } from "../src/page-summary/PageSummaryRenderer"

describe("page summary renderer", () => {
    it("opens a modal from the bottom button and keeps dismissal after updates", () => {
        const anchor = document.createElement("article")
        document.body.append(anchor)
        const handle = renderPageSummary(anchor, { status: "loading" })
        const host = document.querySelector(".mewcat-page-summary")!
        const shadow = host.shadowRoot!
        const dialog = shadow.querySelector("dialog")!
        dialog.showModal = vi.fn(() => {
            dialog.open = true
        })
        dialog.close = vi.fn(() => {
            dialog.open = false
        })
        expect(dialog.open).toBe(false)
        shadow.querySelector<HTMLButtonElement>(".trigger")!.click()
        expect(dialog.showModal).toHaveBeenCalledOnce()
        handle.update({
            status: "success",
            summary: "总结内容",
            pageType: "technical"
        })
        expect(dialog.open).toBe(true)
        shadow.querySelector<HTMLButtonElement>(".close")!.click()
        expect(dialog.open).toBe(false)
        shadow.querySelector<HTMLButtonElement>(".dismiss")!.click()
        handle.update({ status: "error" })
        expect(shadow.querySelector<HTMLElement>(".launcher")!.hidden).toBe(
            true
        )
        expect(anchor.nextElementSibling).toBeNull()
        handle.remove()
    })
    it("renders loading and success states in a shadow card", () => {
        const anchor = document.createElement("article")
        document.body.append(anchor)
        const handle = renderPageSummary(anchor, { status: "loading" })
        const host = document.querySelector(
            ".mewcat-page-summary"
        ) as HTMLElement

        expect(host.shadowRoot?.textContent).toContain("正在总结")
        handle.update({
            status: "success",
            pageType: "technical",
            summary: "核心概念总结"
        })
        expect(host.shadowRoot?.textContent).toContain("核心概念总结")
        expect(host.shadowRoot?.textContent).toContain("technical")

        handle.remove()
        expect(document.querySelector(".mewcat-page-summary")).toBeNull()
    })
})
