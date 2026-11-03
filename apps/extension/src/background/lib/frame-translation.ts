import {
    isFrameTranslationState,
    type FrameTranslationState
} from "@/translation/frameTranslation"

export function registerFrameTranslation(): void {
    const injected = new Map<string, string>()
    const pending = new Map<string, Promise<void>>()
    const tabContexts = new Map<number, object>()
    const getContext = (tabId: number) => {
        if (!tabContexts.has(tabId)) tabContexts.set(tabId, {})
        return tabContexts.get(tabId)
    }
    const clearTab = (tabId: number) => {
        tabContexts.delete(tabId)
        for (const key of injected.keys())
            if (key.startsWith(`${tabId}:`)) injected.delete(key)
    }
    const sendToFrame = (
        tabId: number,
        message: unknown,
        options: { frameId?: number; documentId?: string }
    ): Promise<unknown> =>
        new Promise(resolve => {
            try {
                chrome.tabs.sendMessage(tabId, message, options, response => {
                    resolve(chrome.runtime.lastError ? undefined : response)
                })
            } catch {
                resolve(undefined)
            }
        })
    const getState = async (tabId: number) => {
        const context = getContext(tabId)
        const state = await sendToFrame(
            tabId,
            { type: "MEWCAT_FRAME_STATE" },
            { frameId: 0 }
        )
        return tabContexts.get(tabId) === context &&
            isFrameTranslationState(state)
            ? state
            : undefined
    }
    const sync = async (
        tabId: number,
        onlyFrameId?: number,
        finalState?: FrameTranslationState
    ) => {
        const context = getContext(tabId)
        // 顶层已卸载时只允许用它最后的关闭状态清理子框架。
        const state = (await getState(tabId)) ?? finalState
        if (!state || tabContexts.get(tabId) !== context) return
        const frames =
            (await chrome.webNavigation.getAllFrames({ tabId })) ?? []
        if (tabContexts.get(tabId) !== context) return
        const liveKeys = new Set(
            frames.map(frame => `${tabId}:${frame.frameId}`)
        )
        for (const key of injected.keys())
            if (key.startsWith(`${tabId}:`) && !liveKeys.has(key))
                injected.delete(key)
        await Promise.allSettled(
            frames
                .filter(
                    frame =>
                        frame.frameId !== 0 &&
                        (onlyFrameId === undefined ||
                            frame.frameId === onlyFrameId) &&
                        /^(https?:|file:|about:(blank|srcdoc)(?:$|[?#]))/.test(
                            frame.url
                        )
                )
                .map(async frame => {
                    const key = `${tabId}:${frame.frameId}`
                    const documentKey = frame.documentId ?? frame.url
                    const target = frame.documentId
                        ? { tabId, documentIds: [frame.documentId] }
                        : { tabId, frameIds: [frame.frameId] }
                    if (state.enabled && injected.get(key) !== documentKey) {
                        const pendingKey = `${key}:${documentKey}`
                        let injection = pending.get(pendingKey)
                        if (!injection) {
                            injection = chrome.scripting
                                .executeScript({
                                    target,
                                    files: [
                                        "/content-scripts/frame-translate.js"
                                    ]
                                })
                                .then(() => {
                                    if (tabContexts.get(tabId) === context)
                                        injected.set(key, documentKey)
                                })
                                .finally(() => pending.delete(pendingKey))
                            pending.set(pendingKey, injection)
                        }
                        await injection
                    }
                    if (tabContexts.get(tabId) !== context) return
                    const latest = (await getState(tabId)) ?? finalState
                    if (!latest || tabContexts.get(tabId) !== context) return
                    await sendToFrame(
                        tabId,
                        { type: "MEWCAT_FRAME_APPLY", state: latest },
                        frame.documentId
                            ? { documentId: frame.documentId }
                            : { frameId: frame.frameId }
                    )
                })
        )
    }

    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (
            message?.type !== "MEWCAT_FRAME_GET" &&
            message?.type !== "MEWCAT_FRAME_SYNC"
        )
            return
        const tabId = sender.tab?.id
        if (
            sender.id !== chrome.runtime.id ||
            tabId === undefined ||
            (message.type === "MEWCAT_FRAME_SYNC" && sender.frameId !== 0)
        ) {
            respond(undefined)
            return
        }
        const task =
            message.type === "MEWCAT_FRAME_GET"
                ? getState(tabId)
                : sync(
                      tabId,
                      undefined,
                      isFrameTranslationState(message.state) &&
                          !message.state.enabled
                          ? message.state
                          : undefined
                  ).then(() => ({ success: true }))
        void task.then(respond).catch(() => respond(undefined))
        return true
    })
    chrome.webNavigation.onCompleted.addListener(details => {
        if (details.frameId === 0) return
        return sync(details.tabId, details.frameId).catch(() => undefined)
    })
    chrome.webNavigation.onCommitted.addListener(details => {
        if (details.frameId === 0) clearTab(details.tabId)
        else injected.delete(`${details.tabId}:${details.frameId}`)
    })
    chrome.tabs.onRemoved.addListener(clearTab)
}
