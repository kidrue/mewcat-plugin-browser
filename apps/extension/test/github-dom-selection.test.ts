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
    it.each([
        ["settings", 'aria-label="Account settings"'],
        ["settings/profile", 'aria-label="Account settings"'],
        [
            "settings/security?tab=authentication",
            'aria-label="Account settings"'
        ],
        ["owner/repo/settings", 'aria-label="Settings navigation"'],
        ["owner/repo/settings/branches", ""],
        [
            "organizations/example/settings/profile",
            'aria-label="Organization settings"'
        ],
        [
            "enterprises/example/settings/profile",
            'aria-label="Enterprise settings"'
        ]
    ])(
        "extracts the settings sidebar outside main on %s",
        async (path, attributes) => {
            document.body.innerHTML = `
            <header><nav><a href="/explore">Explore GitHub</a></nav></header>
            <div class="Layout">
                <aside class="Layout-sidebar">
                    <nav ${attributes}>
                        <ul class="ActionList">
                            <li><h2>Access management</h2></li>
                            <li><a href="#profile"><span class="ActionListItem-label">Public profile</span></a></li>
                            <li><button><span class="ActionListItem-label">Password and authentication</span></button></li>
                            ${Array.from({ length: 50 }, (_, index) => `<li><a href="#setting-${index}">Additional account setting ${index}</a></li>`).join("")}
                        </ul>
                    </nav>
                </aside>
                <main><h1>Settings overview</h1><p>Manage your preferences.</p></main>
            </div>`
            const selector = await createSelector(path)
            const text = selector
                .extractTargetTextNodes()
                .result.map(node => node.originText)
                .join(" ")
            expect(text).toContain("Access management")
            expect(text).toContain("Public profile")
            expect(text).toContain("Password and authentication")
            expect(text).toContain("Additional account setting 49")
            expect(text).toContain("Manage your preferences.")
            expect(text).not.toContain("Explore GitHub")

            document
                .querySelector(".ActionList")!
                .insertAdjacentHTML(
                    "beforeend",
                    '<li><a href="#billing">Billing and licensing</a></li>'
                )
            expect(
                selector
                    .extractTargetTextNodes()
                    .result.map(node => node.originText)
                    .join(" ")
            ).toContain("Billing and licensing")
        }
    )

    it("extracts legacy settings menu links without a nav element", async () => {
        document.body.innerHTML = `
            <aside class="Layout-sidebar"><div class="menu">
                <a href="/settings/profile">Public profile</a>
                <a href="/settings/admin">Account security</a>
                ${Array.from({ length: 50 }, (_, index) => `<a href="#legacy-${index}">Additional account setting ${index}</a>`).join("")}
            </div></aside>
            <main><p>Manage your account preferences.</p></main>`
        const selector = await createSelector("settings/profile")
        const text = selector
            .extractTargetTextNodes()
            .result.map(node => node.originText)
            .join(" ")
        expect(text).toContain("Public profile")
        expect(text).toContain("Account security")
    })

    it.each([
        "kidrue/resume/settings",
        "kidrue/resume/settings/branches",
        "owner/repo/settings?tab=general"
    ])("extracts a long repository settings sidebar on %s", async path => {
        document.body.innerHTML = `
            <main>
                <aside class="Layout-sidebar">
                    <nav aria-label="Repository settings">
                        <ul class="ActionList">
                            <li><a href="/kidrue/resume/settings"><span class="ActionListItem-label">General</span></a></li>
                            <li><h2 class="ActionList-sectionDivider-title">Code and automation</h2></li>
                            <li><a href="/kidrue/resume/settings/branches"><span class="ActionListItem-label">Branches</span></a></li>
                            <li><button><span class="ActionListItem-label">Actions</span></button>
                                <ul><li><a href="/kidrue/resume/settings/actions/runners">Runners</a></li></ul>
                            </li>
                            ${Array.from({ length: 50 }, (_, index) => `<li><a href="/kidrue/resume/settings/item-${index}">Additional repository setting ${index}</a></li>`).join("")}
                        </ul>
                    </nav>
                </aside>
                <section class="Layout-main"><h1>General settings</h1><p>Configure your repository features.</p></section>
            </main>`
        const selector = await createSelector(path)
        const text = selector
            .extractTargetTextNodes()
            .result.map(node => node.originText)
            .join(" ")
        expect(text).toContain("General settings")
        expect(text).toContain("Code and automation")
        expect(text).toContain("Branches")
        expect(text).toContain("Actions")
        expect(text).toContain("Runners")
        expect(text).toContain("Additional repository setting 49")
        expect(text).toContain("Configure your repository features.")
    })

    it.each(["owner/repo/issues", "owner/repo/settings-preview"])(
        "keeps repository settings targets scoped away from %s",
        async path => {
            document.body.innerHTML = `
                <main>
                    <aside class="Layout-sidebar"><nav aria-label="Repository settings"><a href="/owner/repo/settings/branches">Branches</a></nav></aside>
                    <p>Unrelated navigation content</p>
                </main>`
            const selector = await createSelector(path)
            const text = selector
                .extractTargetTextNodes()
                .result.map(node => node.originText)
                .join(" ")
            expect(text).not.toContain("Branches")
            expect(text).not.toContain("Unrelated navigation content")
        }
    )

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
