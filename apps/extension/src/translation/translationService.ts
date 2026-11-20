import {
    GOOGLE_TRANSLATE_MODEL_ID,
    MEWCAT_TRANSLATE_MODEL_ID,
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
import { MewCatTranslator } from "./MewCatTranslator"
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
import { resolvePageAiRole, type PageRoleContext } from "./pageAiRole"

export interface TranslationRuntimeConfig {
    sourceLanguage?: string
    currentModel?: string
    aiModelList: BaseModel[]
    aiRole: AiRole
    enableAutoAiRole?: boolean
    enableThinking?: boolean
    enableContext?: boolean
}

export interface TranslationCallOptions {
    pageTitle?: string
    context?: string
    pageContext?: PageRoleContext
}

export interface TranslationServiceDependencies {
    modelGatewaySender?: ModelGatewaySender
    modelGatewayStreamSender?: ModelGatewayStreamSender
    googleRequestSender?: TranslateRequestSender
    microsoftRequestSender?: TranslateRequestSender
    mewcatRequestSender?: TranslateRequestSender
}

export class TranslationServiceUnavailableError extends Error {
    constructor() {
        super("没有对应的翻译服务，请在设置中选择可用的翻译服务。")
        this.name = "TranslationServiceUnavailableError"
    }
}

export class ConceptExplanationUnavailableError extends Error {
    readonly code = "AI_MODEL_REQUIRED"

    constructor() {
        super("没有对应的翻译服务支持概念解释，请选择可用的生成式 AI 模型。")
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
    config: Pick<TranslationRuntimeConfig, "currentModel" | "aiModelList">
): BaseModel | undefined => {
    const serviceId = resolveTranslationServiceId(config)
    if (
        !serviceId ||
        serviceId === GOOGLE_TRANSLATE_MODEL_ID ||
        serviceId === MICROSOFT_TRANSLATE_MODEL_ID ||
        serviceId === MEWCAT_TRANSLATE_MODEL_ID
    )
        return undefined

    const model = config.aiModelList.find(item => item?.id === serviceId)
    if (isConfiguredGenerativeModel(model)) return model
    if (
        model?.enabled === true &&
        PROVIDER_REGISTRY[model.type]?.kind === "translation-engine" &&
        typeof model.params?.apiKey === "string" &&
        model.params.apiKey.trim()
    )
        return model
    return undefined
}

export const isConfiguredGenerativeModel = (
    model: BaseModel | undefined
): boolean => {
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

export const getSelectedGenerativeModel = (
    config: Pick<TranslationRuntimeConfig, "currentModel" | "aiModelList">
): BaseModel | undefined => {
    const selectedModel = getSelectedModel(config)
    return isConfiguredGenerativeModel(selectedModel)
        ? selectedModel
        : undefined
}

const getGoogleTranslator = (dependencies: TranslationServiceDependencies) =>
    new GoogleTranslator(dependencies.googleRequestSender)

function translateWithService(
    method: "translateText" | "translateBatch",
    config: TranslationRuntimeConfig,
    messages: Message[],
    targetLanguage: string,
    options: TranslationCallOptions,
    dependencies: TranslationServiceDependencies
): Promise<string> {
    const serviceId = resolveTranslationServiceId(config)
    if (serviceId === GOOGLE_TRANSLATE_MODEL_ID) {
        return new GoogleTranslator(
            dependencies.googleRequestSender,
            config.sourceLanguage
        )[method](messages, targetLanguage)
    }
    if (serviceId === MICROSOFT_TRANSLATE_MODEL_ID) {
        return new MicrosoftTranslator(
            dependencies.microsoftRequestSender,
            config.sourceLanguage
        )[method](messages, targetLanguage)
    }
    if (serviceId === MEWCAT_TRANSLATE_MODEL_ID) {
        return new MewCatTranslator(
            dependencies.mewcatRequestSender,
            config.sourceLanguage,
            config.enableContext ? options.context : undefined
        )[method](messages, targetLanguage)
    }
    const model = getSelectedModel(config)
    if (!model) {
        throw new TranslationServiceUnavailableError()
    }
    const translateModel =
        method === "translateText" ? translateModelText : translateModelBatch
    return translateModel(
        model,
        messages,
        targetLanguage,
        {
            aiRole: resolvePageAiRole(config, options.pageContext),
            enableThinking: config.enableThinking,
            pageTitle: options.pageTitle,
            sourceLanguage: config.sourceLanguage
        },
        dependencies.modelGatewaySender
    )
}

export async function translateText(
    config: TranslationRuntimeConfig,
    messages: Message[],
    targetLanguage: string,
    options: TranslationCallOptions = {},
    dependencies: TranslationServiceDependencies = {}
): Promise<string> {
    return translateWithService(
        "translateText",
        config,
        messages,
        targetLanguage,
        options,
        dependencies
    )
}

export async function translateBatch(
    config: TranslationRuntimeConfig,
    messages: Message[],
    targetLanguage: string,
    options: TranslationCallOptions = {},
    dependencies: TranslationServiceDependencies = {}
): Promise<string> {
    return translateWithService(
        "translateBatch",
        config,
        messages,
        targetLanguage,
        options,
        dependencies
    )
}

export async function buildAiSummary(
    config: TranslationRuntimeConfig,
    title: string,
    textContent: string,
    dependencies: TranslationServiceDependencies = {}
): Promise<string> {
    const model = getSelectedGenerativeModel(config)
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
    const model = getSelectedGenerativeModel(config)
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
    const model = getSelectedGenerativeModel(config)
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
    return Boolean(getSelectedGenerativeModel(config))
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
