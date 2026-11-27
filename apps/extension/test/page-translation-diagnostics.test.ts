// @vitest-environment jsdom
import { expect, it, vi } from "vitest"

import { DebugManager } from "../src/features/page-translation/DebugManager"

it("reports multiple element classes as a CSS selector in DOM order diagnostics", () => {
    const node = document.createElement("article")
    node.className = "reader article-body"
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const group = vi.spyOn(console, "group").mockImplementation(() => {})
    const groupEnd = vi.spyOn(console, "groupEnd").mockImplementation(() => {})

    try {
        new DebugManager(true).validateDOMOrder(
            [node],
            [node],
            [node],
            nodes => nodes
        )
        const descriptions = log.mock.calls
            .map(([message]) => String(message))
            .filter(message => message.startsWith("  1: "))
        expect(descriptions).toHaveLength(3)
        for (const description of descriptions) {
            expect(description).toContain("[article.reader.article-body]")
        }
    } finally {
        log.mockRestore()
        group.mockRestore()
        groupEnd.mockRestore()
    }
})
