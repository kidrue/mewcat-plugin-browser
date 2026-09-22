import {
    GOOGLE_TRANSLATE_MODEL_ID,
    MICROSOFT_TRANSLATE_MODEL_ID
} from "@/constants/translationServices"
import type {
    ModelGatewayStreamOptions,
    ModelGatewayStreamSender
} from "@/messaging/modelGatewayContracts"
import { PROVIDER_REGISTRY } from "@/model-management/providers"
import { resolveTranslationServiceId } from "@/state/translationService"
import type { AiRole, BaseModel, Message } from "@/types"

import {
    GoogleTranslator,
    type TranslateRequestSender
} from "./GoogleTranslator"
import { MicrosoftTranslator } from "./MicrosoftTranslator"
import {
    abortModelTranslations,
    buildModelSummary,
    explainModelConcept,
    ModelGatewayClientError,
    streamModelConcept,
    translateModelBatch,
    translateModelText,
    type ConceptExplanationInput,
    type ModelGatewaySender
} from "./modelTranslation"

export interface TranslationRuntimeConfig {
    currentModel?: string
    aiModelList: BaseModel[]
    aiRole: AiRole
    enableThinking?: boolean
}

export interface TranslationCallOptions {
    pageTitle?: string
}

export interface TranslationServiceDependencies {
    modelGatewaySender?: ModelGatewaySender
    modelGatewayStreamSender?: ModelGatewayStreamSender
    googleRequestSender?: TranslateRequestSender
    microsoftRequestSender?: TranslateRequestSender
}

export class ConceptExplanationUnavailableError extends Error {
    readonly code = "AI_MODEL_REQUIRED"

    constructor() {
        super("配置生成式 AI 模型后可使用概念解释")
        this.name = "ConceptExplanationUnavailableError"
    }
}

export function getConceptExplanationErrorMessage(error: unknown): string {
    if (error instanceof ConceptExplanationUnavailableError) {
        return error.message
    }
    if (
        error instanceof ModelGatewayClientError &&
        error.code !== "NETWORK_FAILURE"
    ) {
        return error.message
    }
    return "概念解释失败，请稍后重试"
}

const getSelectedModel = (
    config: TranslationRuntimeConfig
): BaseModel | undefined => {
    const serviceId = resolveTranslationServiceId(config)
    return serviceId === GOOGLE_TRANSLATE_MODEL_ID ||
        serviceId === MICROSOFT_TRANSLATE_MODEL_ID
        ? undefined
        : config.aiModelList.find(model => model.id === serviceId)
}

export const isConfiguredGenerativeModel = (model: BaseModel): boolean => {
    if (!model || typeof model !== "object") {
        return false
    }
    const apiKey = model.params?.apiKey
    const modelName = model.params?.modelName
    return (
        model.enabled === true &&
        PROVIDER_REGISTRY[model.type]?.kind === "llm" &&
        typeof apiKey === "string" &&
        apiKey.trim().length > 0 &&
        typeof modelName === "string" &&
        modelName.trim().length > 0
    )
}

const getConceptExplanationModel = (
    config: TranslationRuntimeConfig
): BaseModel | undefined => {
    const selectedModel = getSelectedModel(config)
    if (selectedModel && isConfiguredGenerativeModel(selectedModel)) {
        return selectedModel
    }
    return config.aiModelList.find(isConfiguredGenerativeModel)
}

const getGoogleTranslator = (dependencies: TranslationServiceDependencies) =>
    new GoogleTranslator(dependencies.googleRequestSender)

export async function translateText(
    config: TranslationRuntimeConfig,
    messages: Message[],
    targetLanguage: string,
    options: TranslationCallOptions = {},
    dependencies: TranslationServiceDependencies = {}
): Promise<string> {
    if (resolveTranslationServiceId(config) === MICROSOFT_TRANSLATE_MODEL_ID) {
        return new MicrosoftTranslator(
            dependencies.microsoftRequestSender
        ).translateText(messages, targetLanguage)
    }
    const model = getSelectedModel(config)
    if (!model) {
        return getGoogleTranslator(dependencies).translateText(
            messages,
            targetLanguage
        )
    }
    return translateModelText(
        model,
        messages,
        targetLanguage,
        {
            aiRole: config.aiRole,
            enableThinking: config.enableThinking,
            pageTitle: options.pageTitle
        },
        dependencies.modelGatewaySender
    )
}

export async function translateBatch(
    config: TranslationRuntimeConfig,
    messages: Message[],
    targetLanguage: string,
    options: TranslationCallOptions = {},
    dependencies: TranslationServiceDependencies = {}
): Promise<string> {
    if (resolveTranslationServiceId(config) === MICROSOFT_TRANSLATE_MODEL_ID) {
        return new MicrosoftTranslator(
            dependencies.microsoftRequestSender
        ).translateBatch(messages, targetLanguage)
    }
    const model = getSelectedModel(config)
    if (!model) {
        return getGoogleTranslator(dependencies).translateBatch(
            messages,
            targetLanguage
        )
    }
    return translateModelBatch(
        model,
        messages,
        targetLanguage,
        {
            aiRole: config.aiRole,
            enableThinking: config.enableThinking,
            pageTitle: options.pageTitle
        },
        dependencies.modelGatewaySender
    )
}

export async function buildAiSummary(
    config: TranslationRuntimeConfig,
    title: string,
    textContent: string,
    dependencies: TranslationServiceDependencies = {}
): Promise<string> {
    const model = getSelectedModel(config)
    if (!model) {
        return ""
    }
    return buildModelSummary(
        model,
        title,
        textContent,
        { enableThinking: config.enableThinking },
        dependencies.modelGatewaySender
    )
}

export function explainConcept(
    config: TranslationRuntimeConfig,
    input: ConceptExplanationInput,
    targetLanguage: string,
    dependencies: TranslationServiceDependencies = {}
): Promise<string> {
    const model = getConceptExplanationModel(config)
    if (!model) {
        return Promise.reject(new ConceptExplanationUnavailableError())
    }
    return explainModelConcept(
        model,
        input,
        targetLanguage,
        { enableThinking: config.enableThinking },
        dependencies.modelGatewaySender
    )
}

export function streamConceptExplanation(
    config: TranslationRuntimeConfig,
    input: ConceptExplanationInput,
    targetLanguage: string,
    options: ModelGatewayStreamOptions,
    dependencies: TranslationServiceDependencies = {}
): Promise<string> {
    const model = getConceptExplanationModel(config)
    if (!model) {
        return Promise.reject(new ConceptExplanationUnavailableError())
    }
    return streamModelConcept(
        model,
        input,
        targetLanguage,
        { ...options, enableThinking: config.enableThinking },
        dependencies.modelGatewayStreamSender
    )
}

export function hasAITranslationEnabled(
    config: TranslationRuntimeConfig
): boolean {
    const model = getSelectedModel(config)
    return Boolean(model && model.type !== "DEEPL" && model.type !== "DEEPLX")
}

export async function testConfiguredModel(
    model: BaseModel,
    targetLanguage: string,
    aiRole: AiRole,
    dependencies: TranslationServiceDependencies = {}
): Promise<string> {
    return translateModelBatch(
        model,
        [{ role: "user", content: "Hello, world!" }],
        targetLanguage,
        { aiRole, enableThinking: false },
        dependencies.modelGatewaySender
    )
}

export async function abortAllTranslations(
    dependencies: TranslationServiceDependencies = {}
): Promise<void> {
    await Promise.allSettled([
        abortModelTranslations(dependencies.modelGatewaySender),
        Promise.resolve(
            getGoogleTranslator(dependencies).abortAllTranslations()
        )
    ])
}
