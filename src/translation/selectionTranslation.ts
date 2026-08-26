import type { ExtensionConfig } from "@/types/config"
import type { Message } from "@/types/translation"

export interface SelectionTranslationClient {
    translateText(messages: Message[], targetLanguage: string): Promise<string>
}

export function notifySelectionTranslationFinished(
    callback?: () => void
): void {
    callback?.()
}

export function getSelectionPanelVisibility(
    isVisible: boolean
): "visible" | "hidden" {
    return isVisible ? "visible" : "hidden"
}

export function translateSelectedText(
    client: SelectionTranslationClient,
    text: string,
    config: Pick<ExtensionConfig, "targetLanguage">
): Promise<string> {
    return client.translateText(
        [
            {
                role: "user",
                content: text
            }
        ],
        config.targetLanguage
    )
}
