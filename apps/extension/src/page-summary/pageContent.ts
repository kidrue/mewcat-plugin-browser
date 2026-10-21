export interface PageContentSnapshot {
    title: string
    text: string
    anchor: Element | null
}

const CONTENT_SELECTORS = [
    "article",
    "main",
    '[role="main"]',
    ".article",
    ".post-content",
    ".entry-content"
]

export function extractPageContent(document: Document): PageContentSnapshot {
    const candidates = CONTENT_SELECTORS.map(selector =>
        document.querySelector(selector)
    ).filter((element): element is Element => Boolean(element))
    const anchor =
        candidates.sort(
            (left, right) =>
                (right.textContent?.length ?? 0) -
                (left.textContent?.length ?? 0)
        )[0] ?? document.body
    const text = (anchor?.textContent ?? document.body?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 12000)

    return {
        title: document.title.trim(),
        text,
        anchor
    }
}
