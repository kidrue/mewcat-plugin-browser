export interface Message {
    content: string
    id?: string
    role: "assistant" | "user" | "system" | string
}

/** GoogleTranslator 保留的最小翻译器契约。 */
export interface TranslatorInterface {
    readonly provider: string
    translateText(messages: Message[], targetLang: string): Promise<string>
    translateBatch(messages: Message[], targetLang: string): Promise<string>
    checkConnection(): Promise<boolean>
    abortAllTranslations(): void
}
