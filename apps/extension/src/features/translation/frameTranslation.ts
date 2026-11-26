/** 只同步会话控制信息，配置和凭据由每个扩展运行时自行读取。 */
export interface FrameTranslationState {
    sessionId: string
    revision: number
    enabled: boolean
    sourceLanguage: string
    manual: boolean
}

export function isFrameTranslationState(
    value: unknown
): value is FrameTranslationState {
    if (!value || typeof value !== "object") return false
    const state = value as FrameTranslationState
    return (
        typeof state.sessionId === "string" &&
        !!state.sessionId &&
        Number.isSafeInteger(state.revision) &&
        state.revision >= 0 &&
        typeof state.enabled === "boolean" &&
        typeof state.sourceLanguage === "string" &&
        typeof state.manual === "boolean"
    )
}

export function notifyFrameTranslation(state?: FrameTranslationState): void {
    try {
        chrome.runtime.sendMessage({ type: "MEWCAT_FRAME_SYNC", state }, () => {
            void chrome.runtime.lastError
        })
    } catch {
        // 扩展更新失效不影响正文翻译和清理。
    }
}
