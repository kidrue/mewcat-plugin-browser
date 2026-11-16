// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"

import {
    PAGE_SUMMARY_DOCK_EVENT,
    renderPageSummary
} from "../src/page-summary/PageSummaryRenderer"

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()))

describe("page summary renderer", () => {
    it.each([false, true])(
        "docks beside the floating actions even when they mount later (%s)",
        mountLater => {
            const overlay = document.createElement("div")
            overlay.id = "translation-control-center-overlay"
            const controls = overlay.attachShadow({ mode: "open" })
            controls.innerHTML = "<div data-mewcat-page-summary-slot></div>"
            const slot = controls.firstElementChild!
            const onTranslate = vi.fn()
            slot.addEventListener("click", onTranslate)
            if (!mountLater) document.body.append(overlay)
            const handle = renderPageSummary(document.body, {
                status: "loading"
            })
            cleanups.push(() => {
                handle.remove()
                overlay.remove()
            })
            if (mountLater) {
                document.body.append(overlay)
                document.dispatchEvent(new Event(PAGE_SUMMARY_DOCK_EVENT))
            }
            const host = slot.querySelector<HTMLElement>(".mewcat-page-summary")
            expect(host).not.toBeNull()
            const trigger =
                host!.shadowRoot!.querySelector<HTMLButtonElement>(".trigger")!
            expect(trigger.getAttribute("aria-label")).toBe("页面总结")
            expect(trigger.querySelector("svg")).not.toBeNull()
            const dialog = host!.shadowRoot!.querySelector("dialog")!
            dialog.showModal = vi.fn(() => {
                dialog.open = true
            })
            trigger.click()
            expect(dialog.open).toBe(true)
            expect(onTranslate).not.toHaveBeenCalled()
            handle.remove()
            document.dispatchEvent(new Event(PAGE_SUMMARY_DOCK_EVENT))
            expect(slot.querySelector(".mewcat-page-summary")).toBeNull()
            overlay.remove()
        }
    )

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
