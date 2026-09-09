// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { extractPageContent } from "../src/page-summary/pageContent"
import { classifyPageType } from "../src/page-summary/pageTypes"

describe("page summary content extraction", () => {
    it("extracts a bounded article snapshot and real content anchor", () => {
        const document = new DOMParser().parseFromString(
            "<!doctype html><html><head><title>Guide</title></head><body><main><article><h1>Guide</h1><p>Useful content.</p></article></main></body></html>",
            "text/html"
        )

        const snapshot = extractPageContent(document)

        expect(snapshot.title).toBe("Guide")
        expect(snapshot.text).toContain("Useful content.")
        expect(snapshot.anchor?.tagName).toBe("ARTICLE")
    })

    it("classifies news, academic, technical, product, discussion and general pages", () => {
        const createDocument = (jsonLd: string, body: string) =>
            new DOMParser().parseFromString(
                `<html><head><script type="application/ld+json">${jsonLd}</script></head><body>${body}</body></html>`,
                "text/html"
            )

        expect(
            classifyPageType(createDocument('{"@type":"NewsArticle"}', "news"))
        ).toBe("news")
        expect(
            classifyPageType(
                createDocument('{"@type":"ScholarlyArticle"}', "abstract")
            )
        ).toBe("academic")
        expect(
            classifyPageType(createDocument("", "API reference documentation"))
        ).toBe("technical")
        expect(
            classifyPageType(createDocument("", "Buy this product pricing"))
        ).toBe("product")
        expect(
            classifyPageType(
                createDocument("", "Asked question answers replies")
            )
        ).toBe("discussion")
        expect(classifyPageType(createDocument("", "A regular page"))).toBe(
            "general"
        )
    })
})
