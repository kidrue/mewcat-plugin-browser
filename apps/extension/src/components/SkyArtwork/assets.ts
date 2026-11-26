export const getAssetUrl = (path: string) => {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(path)
    }

    return `/${path}`
}
