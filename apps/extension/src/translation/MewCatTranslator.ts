import { MEWCAT_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import { sendMessage } from "@/messaging"
import type { Message, TranslatorInterface } from "@/types"
import { RequestType } from "@/types/request"

import type { TranslateRequestSender } from "./GoogleTranslator"

const BATCH_SEPARATOR = "\n\n%%\n\n"
const MAX_ITEMS = 20
const MAX_CHARACTERS = 5000

export interface TranslationPiece {
    segmentIndex: number
    text: string
}

const splitSegment = (text: string): string[] => {
    const pieces: string[] = []
    let offset = 0
    while (offset < text.length) {
        let end = Math.min(offset + MAX_CHARACTERS, text.length)
        if (
            end < text.length &&
            /[\uD800-\uDBFF]/u.test(text.charAt(end - 1))
        ) {
            end--
        }
        pieces.push(text.slice(offset, end))
        offset = end
    }
    return pieces
}

export const createMewCatBatches = (
    segments: string[]
): TranslationPiece[][] => {
    const batches: TranslationPiece[][] = []
    let batch: TranslationPiece[] = []
    let characters = 0

    const flush = () => {
        if (batch.length > 0) {
            batches.push(batch)
            batch = []
            characters = 0
        }
    }

    segments.forEach((segment, segmentIndex) => {
        if (segment.trim().length === 0) {
            return
        }
        for (const text of splitSegment(segment)) {
            if (
                batch.length >= MAX_ITEMS ||
                characters + text.length > MAX_CHARACTERS
            ) {
                flush()
            }
            batch.push({ segmentIndex, text })
            characters += text.length
        }
    })
    flush()
    return batches
}

export class MewCatTranslator implements TranslatorInterface {
    readonly provider = MEWCAT_TRANSLATE_MODEL_ID

    constructor(
        private readonly requestSender: TranslateRequestSender = request =>
            sendMessage("translate-request", request),
        private readonly sourceLanguage?: string
    ) {}

    private async translateSegments(
        segments: string[],
        targetLanguage: string
    ): Promise<string[]> {
        const translated = segments.map(segment =>
            segment.trim().length === 0 ? segment : ""
        )
        for (const pieces of createMewCatBatches(segments)) {
            const response = await this.requestSender({
                type: RequestType.MEWCAT_TRANSLATE,
                config: {
                    texts: pieces.map(piece => piece.text),
                    targetLanguage,
                    ...(this.sourceLanguage && this.sourceLanguage !== "auto"
                        ? { sourceLanguage: this.sourceLanguage }
                        : {})
                }
            })
            if (!response.success) {
                throw new Error(response.error || "mewCat 翻译请求失败")
            }
            const translations = (
                response.content as { translations?: unknown } | undefined
            )?.translations
            if (
                !Array.isArray(translations) ||
                !translations.every(item => typeof item === "string")
            ) {
                throw new Error("mewCat 翻译返回了无法识别的响应")
            }
            if (translations.length !== pieces.length) {
                throw new Error("mewCat 翻译返回数量不匹配")
            }
            pieces.forEach((piece, index) => {
                translated[piece.segmentIndex] += translations[index]
            })
        }
        return translated
    }

    async translateText(
        messages: Message[],
        targetLang: string
    ): Promise<string> {
        const source = messages.map(message => message.content).join("\n")
        return (await this.translateSegments([source], targetLang))[0]
    }

    async translateBatch(
        messages: Message[],
        targetLang: string
    ): Promise<string> {
        const segments = messages.flatMap(message =>
            message.content.split(BATCH_SEPARATOR)
        )
        return (await this.translateSegments(segments, targetLang)).join(
            BATCH_SEPARATOR
        )
    }

    async checkConnection(): Promise<boolean> {
        try {
            return Boolean(
                await this.translateText(
                    [{ role: "user", content: "Hello" }],
                    "zh-CN"
                )
            )
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
