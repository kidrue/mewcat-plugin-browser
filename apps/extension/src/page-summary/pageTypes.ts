export type PageType =
    | "news"
    | "knowledge"
    | "academic"
    | "technical"
    | "product"
    | "discussion"
    | "general"

const normalize = (value: string): string => value.toLowerCase()

export function classifyPageType(document: Document): PageType {
    const structuredTypes = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
    ).flatMap(script => {
        try {
            const parsed = JSON.parse(script.textContent || "")
            const values = Array.isArray(parsed) ? parsed : [parsed]
            return values.flatMap(value =>
                typeof value?.["@type"] === "string" ? [value["@type"]] : []
            )
        } catch {
            return []
        }
    })

    const structured = normalize(structuredTypes.join(" "))
    if (structured.includes("news")) return "news"
    if (structured.includes("scholarly") || structured.includes("academic")) {
        return "academic"
    }
    if (structured.includes("product")) return "product"

    const text = normalize(
        `${document.title} ${document.body?.textContent?.slice(0, 5000) ?? ""}`
    )
    if (/\b(api|documentation|docs|tutorial|reference|sdk)\b/.test(text)) {
        return "technical"
    }
    if (/\b(buy|price|pricing|product|subscribe|features)\b/.test(text)) {
        return "product"
    }
    if (/\b(question|answer|answers|replies|forum|discussion)\b/.test(text)) {
        return "discussion"
    }
    if (/\b(blog|article|post|guide|essay)\b/.test(text)) {
        return "knowledge"
    }
    return "general"
}
