import { GOOGLE_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import { sendMessage } from "@/messaging"
import type { Message, TranslatorInterface } from "@/types"
import {
    RequestType,
    type UnifiedRequestBody,
    type UnifiedResponse
} from "@/types/request"

export type TranslateRequestSender = (
    request: UnifiedRequestBody
) => Promise<UnifiedResponse>

const sendTranslateRequest: TranslateRequestSender = request =>
    sendMessage("translate-request", request)

export class GoogleTranslator implements TranslatorInterface {
    readonly provider = GOOGLE_TRANSLATE_MODEL_ID

    constructor(
        private readonly requestSender: TranslateRequestSender = sendTranslateRequest
    ) {}

    private async requestTranslation(
        text: string,
        targetLanguage: string
    ): Promise<string> {
        if (!text) {
            return ""
        }

        const response = await this.requestSender({
            type: RequestType.GOOGLE_TRANSLATE,
            config: {
                text,
                targetLanguage,
                timeout: 30_000
            }
        })

        if (!response.success) {
            throw new Error(response.error || "Google 翻译请求失败")
        }
        if (typeof response.content !== "string") {
            throw new Error("Google 翻译返回了无法识别的响应")
        }

        return response.content
    }

    async translateText(
        messages: Message[],
        targetLang: string
    ): Promise<string> {
        return this.requestTranslation(
            messages.map(message => message.content).join("\n"),
            targetLang
        )
    }

    async translateBatch(
        messages: Message[],
        targetLang: string
    ): Promise<string> {
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
