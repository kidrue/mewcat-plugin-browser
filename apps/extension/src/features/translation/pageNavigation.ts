/** 普通章节锚点不会更换正文；路径、查询参数及 hash 路由仍代表换页。 */
export function isSameTranslationPage(
    previous: string,
    current: string
): boolean {
    if (previous === current) return true
    try {
        const before = new URL(previous)
        const after = new URL(current)
        if (
            before.origin !== after.origin ||
            before.pathname !== after.pathname ||
            before.search !== after.search
        )
            return false
        if (/^#(?:\/|!)/.test(before.hash) || /^#(?:\/|!)/.test(after.hash))
            return before.hash === after.hash
        return true
    } catch {
        return false
    }
}
