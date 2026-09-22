import { MICROSOFT_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import { sendMessage } from "@/messaging"
import type { Message, TranslatorInterface } from "@/types"
import { RequestType } from "@/types/request"

import type { TranslateRequestSender } from "./GoogleTranslator"

export class MicrosoftTranslator implements TranslatorInterface {
    readonly provider = MICROSOFT_TRANSLATE_MODEL_ID

    constructor(
        private readonly requestSender: TranslateRequestSender = request =>
            sendMessage("translate-request", request)
    ) {}

    private async requestTranslation(
        text: string,
        targetLanguage: string
    ): Promise<string> {
        if (!text) {
            return ""
        }
        const response = await this.requestSender({
            type: RequestType.MICROSOFT_TRANSLATE,
            config: { text, targetLanguage, timeout: 30_000 }
        })
        if (!response.success) {
            throw new Error(response.error || "微软翻译请求失败")
        }
        if (typeof response.content !== "string") {
            throw new Error("微软翻译返回了无法识别的响应")
        }
        return response.content
    }

    translateText(messages: Message[], targetLang: string): Promise<string> {
        return this.requestTranslation(
            messages.map(message => message.content).join("\n"),
            targetLang
        )
    }

    translateBatch(messages: Message[], targetLang: string): Promise<string> {
        return this.requestTranslation(
            messages.map(message => message.content).join("\n\n%%\n\n"),
            targetLang
        )
    }

    async checkConnection(): Promise<boolean> {
        try {
            return Boolean(await this.requestTranslation("Hello", "zh-CN"))
        } catch {
            return false
        }
    }

    abortAllTranslations(): void {
        void this.requestSender({
            type: RequestType.ABORT,
            config: null
        }).catch(() => {})
    }
}
