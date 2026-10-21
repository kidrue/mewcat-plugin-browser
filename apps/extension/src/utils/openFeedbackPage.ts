let opening: Promise<void> | undefined

export function openFeedbackPage(): Promise<void> {
    if (opening) {
        return opening
    }
    const task = (async () => {
        const url = chrome.runtime.getURL("feedback.html")
        const tabs = await chrome.tabs.query({})
        const existing = tabs.find(tab => tab.url?.split(/[?#]/, 1)[0] === url)
        if (typeof existing?.id === "number") {
            await chrome.tabs.update(existing.id, { active: true })
            if (existing.windowId !== undefined) {
                await chrome.windows.update(existing.windowId, {
                    focused: true
                })
            }
            return
        }
        await chrome.tabs.create({ url })
    })()
    opening = task
    const clear = () => {
        if (opening === task) {
            opening = undefined
        }
    }
    void task.then(clear, clear)
    return task
}
