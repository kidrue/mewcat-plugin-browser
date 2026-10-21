// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import rules from "../src/public/assets/rule.json"
import { DomSelector } from "../src/translation/DomSelector"

beforeEach(() => {
    document.body.innerHTML = ""
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => path } })
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ json: async () => rules }))
    )
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
        () => new DOMRect(0, 0, 500, 300)
    )
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

async function createSelector(path: string) {
    const selector = new DomSelector({
        currentUrl: `https://github.com/${path}`,
        currentHostname: "github.com"
    })
    await selector.initialize()
    return selector
}

describe("GitHub translation targets", () => {
    it("extracts current issue list titles and titles added after navigation", async () => {
        document.body.innerHTML = `
            <main><h3><a data-testid="issue-listitem-title-link" href="/owner/repo/issues/1">
                <span><span data-component="Text">Bug: Extension fails to load</span></span>
            </a></h3></main>`
        const selector = await createSelector("owner/repo/issues")
        expect(
            selector
                .extractTargetTextNodes()
                .result.map(node => node.originText)
                .join(" ")
        ).toContain("Bug: Extension fails to load")

        document.querySelector("main")!.insertAdjacentHTML(
            "beforeend",
            `
            <h3><a data-testid="issue-listitem-title-link" href="/owner/repo/issues/2">
                <span>Support loading additional languages</span>
            </a></h3>`
        )
        expect(
            selector
                .extractTargetTextNodes()
                .result.map(node => node.originText)
                .join(" ")
        ).toContain("Support loading additional languages")
    })

    it("extracts issue hovercard titles while leaving user and repository links alone", async () => {
        document.body.innerHTML = `
            <main>
                <a data-hovercard-type="issue" href="/owner/repo/issues/1">Fix translation of issue titles</a>
                <a data-hovercard-type="user" href="/owner">Example User</a>
                <a data-hovercard-type="repository" href="/owner/repo">Example Repository</a>
            </main>`
        const selector = await createSelector("owner/repo/issues")
        const texts = selector
            .extractTargetTextNodes()
            .result.map(node => node.originText)
        expect(texts.join(" ")).toContain("Fix translation of issue titles")
        expect(texts.join(" ")).not.toContain("Example User")
        expect(texts.join(" ")).not.toContain("Example Repository")
    })

    it("extracts changelog headings and entry links inside the dashboard sidebar", async () => {
        document.body.innerHTML = `
            <aside class="feed-right-sidebar">
                <section class="dashboard-changelog">
                    <h3 class="dashboard-changelog__title">Latest from our changelog</h3>
                    <ul><li>
                        <relative-time>2 days ago</relative-time>
                        <a class="Link--primary Link" href="https://github.blog/changelog/example/">Improved issue search is now available</a>
                    </li></ul>
                    <a href="https://github.blog/changelog/">View changelog</a>
                </section>
                <nav>${"Navigation item ".repeat(100)}</nav>
            </aside>`
        const selector = await createSelector("")
        const texts = selector
            .extractTargetTextNodes()
            .result.map(node => node.originText)
        expect(texts).toContain("Latest from our changelog")
        expect(texts.join(" ")).toContain(
            "Improved issue search is now available"
        )
        expect(texts.join(" ")).toContain("View changelog")
        expect(texts.join(" ")).not.toContain("2 days ago")
        expect(texts.join(" ")).not.toContain("Navigation item")
    })

    it("keeps extracting issue detail titles, body paragraphs and comments", async () => {
        document.body.innerHTML = `
            <h1><bdi class="markdown-title" data-testid="issue-title">Extension does not load</bdi></h1>
            <div class="react-issue-body"><div class="markdown-body"><p>The extension fails when opening this page.</p></div></div>
            <div class="react-issue-comment"><div class="markdown-body"><p>I can reproduce this problem in Chrome.</p></div></div>`
        const selector = await createSelector("owner/repo/issues/1")
        const text = selector
            .extractTargetTextNodes()
            .result.map(node => node.originText)
            .join(" ")
        expect(text).toContain("Extension does not load")
        expect(text).toContain("The extension fails when opening this page.")
        expect(text).toContain("I can reproduce this problem in Chrome.")
    })

    it("keeps distinct link-only paragraphs when one container contains another", async () => {
        document.body.innerHTML = `
            <div class="markdown-body">
                <ul><li><a href="/first">First release update</a></li></ul>
                <a href="/all">View all release updates</a>
            </div>`
        const selector = await createSelector("owner/repo")
        const text = selector
            .extractTargetTextNodes()
            .result.map(node => node.originText)
            .join(" ")
        expect(text).toContain("First release update")
        expect(text).toContain("View all release updates")
    })
})
