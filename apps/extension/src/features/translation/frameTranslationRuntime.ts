import type { ExtensionConfig } from "@/types/config"

import {
    isFrameTranslationState,
    type FrameTranslationState
} from "./frameTranslation"
import type { ImmersiveTranslator } from "./ImmersiveTranslator"

/** 无 UI 的子框架会话，复用现有提取、动态监听及翻译引擎。 */
export function createFrameTranslationRuntime(
    readConfig: () => Promise<ExtensionConfig>,
    createTranslator: (config: ExtensionConfig) => ImmersiveTranslator
) {
    let current: FrameTranslationState | undefined
    let generation = 0
    let disposed = false
    let translator: ImmersiveTranslator | undefined
    const clear = () => {
        translator?.destroy()
        translator = undefined
    }
    return {
        async applyState(state: unknown): Promise<void> {
            if (disposed || !isFrameTranslationState(state)) return
            if (
                current?.sessionId === state.sessionId &&
                current.revision >= state.revision
            )
                return
            current = state
            const request = ++generation
            clear()
            if (!state.enabled) return
            const config = await readConfig()
            if (
                disposed ||
                generation !== request ||
                config.extensionEnabled === false
            )
                return
            translator = createTranslator(config)
            translator.setSourceLanguage(state.sourceLanguage)
            await translator.startImmersiveTranslation({ manual: state.manual })
        },
        dispose() {
            disposed = true
            generation++
            clear()
        }
    }
}
