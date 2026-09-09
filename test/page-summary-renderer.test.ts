// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { renderPageSummary } from "../src/page-summary/PageSummaryRenderer"

describe("page summary renderer", () => {
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
