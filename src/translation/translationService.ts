import { GOOGLE_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import { resolveTranslationServiceId } from "@/state/translationService"
import type { AiRole, BaseModel, Message } from "@/types"

import {
    GoogleTranslator,
    type TranslateRequestSender
} from "./GoogleTranslator"
import {
    abortModelTranslations,
    buildModelSummary,
    translateModelBatch,
    translateModelText,
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
    googleRequestSender?: TranslateRequestSender
}

const getSelectedModel = (
    config: TranslationRuntimeConfig
): BaseModel | undefined => {
    const serviceId = resolveTranslationServiceId(config)
    return serviceId === GOOGLE_TRANSLATE_MODEL_ID
        ? undefined
        : config.aiModelList.find(model => model.id === serviceId)
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
    if (!model) {return ""}
    return buildModelSummary(
        model,
        title,
        textContent,
        { enableThinking: config.enableThinking },
        dependencies.modelGatewaySender
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
