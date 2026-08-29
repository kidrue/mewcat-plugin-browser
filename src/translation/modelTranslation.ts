import { languages } from "@/constants"
import { AiRoleSystemPrompts, RULE_PROMPT } from "@/constants/aiRole"
import { sendMessage } from "@/messaging"
import type {
    ModelGatewayMessage,
    ModelGatewayRequest,
    ModelGatewayResponse
} from "@/messaging/modelGatewayContracts"
import {
    AiModel_Platform_Enum,
    type AiRole,
    type BaseModel,
    type Message
} from "@/types"

export interface TranslationMessageOptions {
    batch: boolean
    pageTitle?: string
}

export interface ModelTranslationOptions {
    aiRole: AiRole
    enableThinking?: boolean
    pageTitle?: string
}

export interface ModelSummaryOptions {
    enableThinking?: boolean
}

export type ModelGatewaySender = (
    request: ModelGatewayRequest
) => Promise<ModelGatewayResponse>

const sendModelGatewayRequest: ModelGatewaySender = request =>
    sendMessage("model-gateway", request)

export class ModelGatewayClientError extends Error {
    constructor(
        readonly code: string,
        message: string,
        readonly status?: number
    ) {
        super(message)
        this.name = "ModelGatewayClientError"
    }
}

const toGatewayMessage = (message: Message): ModelGatewayMessage => ({
    role:
        message.role === "assistant" ||
        message.role === "system" ||
        message.role === "user"
            ? message.role
            : "user",
    content: message.content
})

export function buildTranslationMessages(
    messages: Message[],
    targetLanguage: string,
    aiRole: AiRole,
    options: TranslationMessageOptions
): ModelGatewayMessage[] {
    const targetLanguageName =
        languages.languages.find(item => item.value === targetLanguage)
            ?.label ?? targetLanguage
    const rolePrompt = AiRoleSystemPrompts[aiRole]
    const taskPrompt = options.batch
        ? `${RULE_PROMPT.replace("{{title}}", options.pageTitle ?? "")}
请将以下文本翻译成${targetLanguageName}：`
        : `请将以下文本翻译成${targetLanguageName}，仅返回翻译结果，保持原格式：`

    return [
        { role: "system", content: `${rolePrompt}\n${taskPrompt}` },
        ...messages.map(toGatewayMessage)
    ]
}

const isTranslationEngine = (model: BaseModel): boolean =>
    model.type === AiModel_Platform_Enum.DEEPL ||
    model.type === AiModel_Platform_Enum.DEEPLX

const requestText = async (
    request: ModelGatewayRequest,
    sender: ModelGatewaySender
): Promise<string> => {
    const response = await sender(request)
    if (response.success === false) {
        throw new ModelGatewayClientError(
            response.error.code,
            response.error.message,
            response.error.status
        )
    }
    return response.text
}

const translateWithModel = (
    model: BaseModel,
    messages: Message[],
    targetLanguage: string,
    options: ModelTranslationOptions,
    batch: boolean,
    sender: ModelGatewaySender
): Promise<string> => {
    if (messages.length === 0) {return Promise.resolve("")}
    if (isTranslationEngine(model)) {
        return requestText(
            {
                type: "translate-engine",
                model,
                texts: messages.map(message => message.content).filter(Boolean),
                targetLanguage
            },
            sender
        )
    }
    return requestText(
        {
            type: "generate",
            model,
            messages: buildTranslationMessages(
                messages,
                targetLanguage,
                options.aiRole,
                { batch, pageTitle: options.pageTitle }
            ),
            enableThinking: options.enableThinking
        },
        sender
    )
}

export function translateModelText(
    model: BaseModel,
    messages: Message[],
    targetLanguage: string,
    options: ModelTranslationOptions,
    sender: ModelGatewaySender = sendModelGatewayRequest
): Promise<string> {
    return translateWithModel(
        model,
        messages,
        targetLanguage,
        options,
        false,
        sender
    )
}

export function translateModelBatch(
    model: BaseModel,
    messages: Message[],
    targetLanguage: string,
    options: ModelTranslationOptions,
    sender: ModelGatewaySender = sendModelGatewayRequest
): Promise<string> {
    return translateWithModel(
        model,
        messages,
        targetLanguage,
        options,
        true,
        sender
    )
}

export async function buildModelSummary(
    model: BaseModel,
    title: string,
    textContent: string,
    options: ModelSummaryOptions,
    sender: ModelGatewaySender = sendModelGatewayRequest
): Promise<string> {
    const cleanedText = textContent.trim()
    if (!cleanedText || isTranslationEngine(model)) {return ""}

    const truncatedContent =
        cleanedText.length > 5000
            ? `${cleanedText.slice(0, 5000)}...`
            : cleanedText
    const prompt = `Summarize the following article in 2-3 sentences. Focus on the main topic and key points. Return ONLY the summary, no explanations or formatting.

Title: ${title}

Content:
${truncatedContent}`

    try {
        return await requestText(
            {
                type: "generate",
                model,
                messages: [{ role: "user", content: prompt }],
                enableThinking: options.enableThinking
            },
            sender
        )
    } catch {
        return ""
    }
}

export async function abortModelTranslations(
    sender: ModelGatewaySender = sendModelGatewayRequest
): Promise<void> {
    await sender({ type: "abort" })
}
