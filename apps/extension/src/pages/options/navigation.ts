import { NAVIGATION_ITEMS } from "@/constants/options"

export function resolveOptionsTab(hash: string) {
    const tab = hash.slice(1)
    return tab === "analytics" || NAVIGATION_ITEMS.some(item => item.id === tab)
        ? tab
        : "basic"
}
