import axios from "axios"

import { sendMessage } from "@/messaging"
import type { AiRole } from "@/types"
import {
    AiModel_Platform_Enum,
    GEMINI_ThinkingLevel,
    type Message
} from "@/types"
import {
    RequestType,
    type AiHttpRequestConfig,
    type TranslationEngineRequestConfig,
    type UnifiedRequestBody,
    type UnifiedResponse
} from "@/types/request"

import { languages } from "../constants"
import { AiRoleSystemPrompts, RULE_PROMPT } from "../constants/aiRole"
import { PLATFORM_OFFICIAL_BASE_URLS } from "../constants/model"
import type { Response } from "../services/request"

/**
 * UniversalTranslator 构造函数配置
 */
export interface UniversalTranslatorConfig {
    /** API密钥（必传） */
    apiKey: string
    /** 模型名称（必传） */
    model: string | number
    /** AI角色（必传） */
    aiRole: AiRole
    /** 基础URL（可选） */
    baseUrl?: string
    /** 自定义endpoint（可选） */
    endpoint?: string
    /** 是否启用思考能力（可选） */
    enableThinking?: boolean
}

/**
 * 通用翻译器
 * 组织结构：
 * 1. 请求数据构建器 - 生成请求所需的所有数据结构
 * 2. 请求发送器 - 执行翻译请求
 * 3. 请求中断器 - 中断所有进行中的请求
 */
export class UniversalTranslator {
    private apiKey: string
    private baseUrl: string
    private model: string | number
    private aiRole: AiRole
    readonly provider: AiModel_Platform_Enum
    private enableThinking: boolean
    private static timeout = 60 * 5 * 1000

    constructor(
        provider: AiModel_Platform_Enum,
        config: UniversalTranslatorConfig
    ) {
        this.provider = provider
        this.apiKey = config.apiKey
        this.model = config.model
        this.aiRole = config.aiRole
        this.enableThinking = config.enableThinking || false
        this.baseUrl = this.getBaseUrl(provider, config.baseUrl)
    }

    // ========================================================================
    // 第一部分：请求数据构建器
    // ========================================================================

    /**
     * 获取提供商的基础 URL
     */
    private getBaseUrl(
        provider: AiModel_Platform_Enum,
        customUrl?: string
    ): string {
        const trimmed = customUrl?.trim()
        if (trimmed) {
            return trimmed
        }

        const url = PLATFORM_OFFICIAL_BASE_URLS[provider]
        if (!url) {
            throw new Error(`Unsupported AI provider: ${provider}`)
        }
        return url
    }

    /**
     * 构建请求头
     */
    private buildHeaders(): Record<string, string> {
        const baseHeaders: Record<string, string> = {
            "Content-Type": "application/json"
        }

        switch (this.provider) {
            case AiModel_Platform_Enum.GEMINI:
                baseHeaders["x-goog-api-key"] = this.apiKey
                baseHeaders["x-goog-api-client"] =
                    "google-genai-sdk/1.40.0 gl-node/web"
                break
            case AiModel_Platform_Enum.DEEPL:
                baseHeaders["Authorization"] = `DeepL-Auth-Key ${this.apiKey}`
                break
            case AiModel_Platform_Enum.DEEPLX:
                // DEEPLX API key 在 URL 中
                break
            default:
                baseHeaders["Authorization"] = `Bearer ${this.apiKey}`
                break
        }

        return baseHeaders
    }

    /**
     * 构建请求 URL
     */
    public buildRequestUrl(): string {
        switch (this.provider) {
            case AiModel_Platform_Enum.GEMINI: {
                return `${this.baseUrl}/${this.model}:generateContent`
            }
            case AiModel_Platform_Enum.DEEPL:
                return `${this.baseUrl}/translate`
            case AiModel_Platform_Enum.DEEPLX: {
                if (this.baseUrl.includes("/translate")) {
                    return this.baseUrl
                }
                const cleanBaseUrl = this.baseUrl.replace(/\/$/, "")
                return `${cleanBaseUrl}/${this.apiKey}/translate`
            }
            default:
                return `${this.baseUrl}/chat/completions`
        }
    }

    /**
     * 构建 AI 翻译消息
     */
    private buildAiMessages(
        messages: Message[],
        targetLang: string,
        isBatch: boolean
    ): Message[] {
        const targetLangName =
            languages.languages.find(v => v.value === targetLang)?.label ||
            targetLang

        if (isBatch) {
            const systemPrompt = `${RULE_PROMPT.replace("{{title}}", document.title)}\n请将以下文本翻译成${targetLangName}：`
            return [
                {
                    content: `${AiRoleSystemPrompts[this.aiRole]}\n${systemPrompt}`,
                    role: "system"
                },
                ...messages
            ]
        }

        const systemPrompt = `请将以下文本翻译成${targetLang}，仅返回翻译结果，保持原格式：\n`
        return [
            { content: AiRoleSystemPrompts[this.aiRole], role: "system" },
            { content: systemPrompt, role: "system" },
            ...messages
        ]
    }

    private buildThinkingConfig(): Record<string, unknown> | undefined {
        switch (this.provider) {
            case AiModel_Platform_Enum.GEMINI:
                return {
                    generationConfig: {
                        thinkingConfig: {
                            thinkingLevel: this.enableThinking
                                ? GEMINI_ThinkingLevel.HIGH
                                : GEMINI_ThinkingLevel.LOW
                        }
                    }
                }

            case AiModel_Platform_Enum.DEEPSEEK:
            case AiModel_Platform_Enum.HUOSHAN:
            case AiModel_Platform_Enum.MOONSHOT: {
                return {
                    thinking: {
                        type: this.enableThinking ? "enabled" : "disabled"
                    }
                }
            }

            case AiModel_Platform_Enum.BAILIAN: {
                return {
                    enable_thinking: this.enableThinking
                }
            }

            default: {
                return {}
            }
        }
    }

    /**
     * 适配 AI 请求配置（处理不同提供商的格式差异）
     */
    private buildAiRequestConfig(messages: Message[]): {
        type: RequestType.AI_HTTP
        config: AiHttpRequestConfig
    } {
        const url = this.buildRequestUrl()
        const thinkingConfig = this.buildThinkingConfig()

        // Gemini 使用特殊格式
        if (this.provider === AiModel_Platform_Enum.GEMINI) {
            return {
                type: RequestType.AI_HTTP,
                config: {
                    apiKey: this.apiKey,
                    baseUrl: url,
                    model: this.model,
                    messages: [],
                    contents: messages
                        .filter(m => m.role === "user")
                        .map(msg => ({
                            role: "user",
                            parts: [{ text: msg.content }]
                        })),
                    system_instruction: {
                        parts: messages
                            .filter(m => m.role === "system")
                            .map(m => ({ text: m.content }))
                    },
                    timeout: UniversalTranslator.timeout,
                    headers: this.buildHeaders(),
                    ...thinkingConfig
                }
            }
        }

        // 其他 AI 提供商
        return {
            type: RequestType.AI_HTTP,
            config: {
                apiKey: this.apiKey,
                baseUrl: url,
                model: this.model,
                messages,
                timeout: UniversalTranslator.timeout,
                headers: this.buildHeaders(),
                ...thinkingConfig
            }
        }
    }

    /**
     * 构建翻译引擎请求配置（DEEPL/DEEPLX）
     */
    private buildTranslationEngineConfig(
        messages: Message[],
        targetLang: string
    ): {
        type: RequestType.TRANSLATION_ENGINE
        config: TranslationEngineRequestConfig
    } {
        const texts = messages
            .map(msg => msg.content)
            .filter(content => content && content.trim().length > 0)

        const deeplTargetLang = this.convertToDeepLLanguageCode(targetLang)
        const url = this.buildRequestUrl()

        if (this.provider === AiModel_Platform_Enum.DEEPLX) {
            return {
                type: RequestType.TRANSLATION_ENGINE,
                config: {
                    apiKey: this.apiKey,
                    baseUrl: url,
                    text: texts.join("\n"),
                    target_lang: deeplTargetLang,
                    source_lang: "auto",
                    timeout: UniversalTranslator.timeout,
                    headers: this.buildHeaders()
                }
            }
        }

        // DEEPL 官方 API
        return {
            type: RequestType.TRANSLATION_ENGINE,
            config: {
                apiKey: this.apiKey,
                baseUrl: url,
                text: texts,
                target_lang: deeplTargetLang,
                timeout: UniversalTranslator.timeout,
                headers: this.buildHeaders()
            }
        }
    }

    /**
     * 将语言代码转换为 DeepL 格式
     */
    private convertToDeepLLanguageCode(langCode: string): string {
        const langMap: Record<string, string> = {
            "zh-CN": "ZH",
            "zh-TW": "ZH",
            zh: "ZH",
            en: "EN",
            "en-US": "EN-US",
            "en-GB": "EN-GB",
            ja: "JA",
            ko: "KO",
            fr: "FR",
            de: "DE",
            es: "ES",
            it: "IT",
            pt: "PT",
            "pt-BR": "PT-BR",
            "pt-PT": "PT-PT",
            ru: "RU",
            nl: "NL",
            pl: "PL",
            tr: "TR",
            ar: "AR",
            sv: "SV",
            da: "DA",
            fi: "FI",
            no: "NB",
            cs: "CS",
            el: "EL",
            hu: "HU",
            ro: "RO",
            sk: "SK",
            bg: "BG",
            id: "ID",
            uk: "UK"
        }

        return langMap[langCode] || langCode.toUpperCase()
    }

    /**
     * 解析 AI 响应
     */
    private parseAiResponse(responseData: unknown): string {
        // Gemini 响应格式
        if (this.provider === AiModel_Platform_Enum.GEMINI) {
            const geminiData = responseData as {
                candidates?: Array<{
                    content?: { parts?: Array<{ text?: string }> }
                }>
            }
            return geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ""
        }

        // 标准 OpenAI 格式
        const standardData = responseData as {
            choices?: Array<{ message?: { content?: string } }>
        }
        return standardData?.choices?.[0]?.message?.content || ""
    }

    /**
     * 解析翻译引擎响应
     */
    private parseTranslationEngineResponse(responseData: unknown): string {
        // DEEPLX 响应格式
        if (this.provider === AiModel_Platform_Enum.DEEPLX) {
            const deeplxData = responseData as {
                code?: number
                data?: string
            }

            if (deeplxData.code !== 200) {
                throw new Error(
                    `DeepLX translation failed: code ${deeplxData.code}`
                )
            }

            return deeplxData.data || ""
        }

        // DEEPL 官方 API 响应格式
        const deeplData = responseData as {
            translations?: Array<{ text?: string }>
        }

        if (!deeplData.translations || deeplData.translations.length === 0) {
            return ""
        }

        return deeplData.translations
            .map(t => t.text || "")
            .filter(text => text.length > 0)
            .join("\n")
    }

    // ========================================================================
    // 第二部分：请求发送器
    // ========================================================================

    /**
     * 发送请求到后台
     */
    private async sendRequest(
        requestBody: UnifiedRequestBody
    ): Promise<UnifiedResponse> {
        const response = await sendMessage("translate-request", requestBody)

        const typedResponse = response as UnifiedResponse

        if (!typedResponse.success) {
            throw new Error(typedResponse.error || "Request failed")
        }

        return typedResponse
    }

    /**
     * 翻译单个文本
     */
    async translateText(
        messages: Message[],
        targetLang: string
    ): Promise<string> {
        if (messages.length === 0) {
            return ""
        }

        const aiMessages = this.buildAiMessages(messages, targetLang, false)
        const requestBody = this.buildAiRequestConfig(aiMessages)
        const response = await this.sendRequest(requestBody)

        const translated = this.parseAiResponse(response.content)

        if (!translated) {
            throw new Error("Invalid response: No translation content")
        }

        return translated
    }

    /**
     * AI 批量翻译
     */
    async aiTranslateBatch(
        messages: Message[],
        targetLang: string
    ): Promise<string> {
        if (messages.length === 0) {
            return ""
        }

        const aiMessages = this.buildAiMessages(messages, targetLang, true)
        const requestBody = this.buildAiRequestConfig(aiMessages)
        const response = await this.sendRequest(requestBody)

        const translated = this.parseAiResponse(response.content)

        if (!translated) {
            const traceId =
                response.headers?.["x-trace-id"] ||
                response.headers?.["trace-id"]
            const errorMsg = traceId
                ? `Invalid response: No batch translation content (Trace-ID: ${traceId})`
                : "Invalid response: No batch translation content"
            throw new Error(errorMsg)
        }

        return translated
    }

    /**
     * 翻译引擎批量翻译（DEEPL/DEEPLX）
     */
    async normalTranslateBatch(
        messages: Message[],
        targetLang: string
    ): Promise<string> {
        if (messages.length === 0) {
            return ""
        }

        const requestBody = this.buildTranslationEngineConfig(
            messages,
            targetLang
        )
        const response = await this.sendRequest(requestBody)

        if (response && response.content) {
            return this.parseTranslationEngineResponse(response.content)
        }

        return ""
    }

    /**
     * 批量翻译（自动选择 AI 或翻译引擎）
     */
    async translateBatch(
        messages: Message[],
        targetLang: string
    ): Promise<string> {
        const isTranslationEngine = [
            AiModel_Platform_Enum.DEEPLX,
            AiModel_Platform_Enum.DEEPL
        ].includes(this.provider)

        if (isTranslationEngine) {
            return this.normalTranslateBatch(messages, targetLang)
        }
        return this.aiTranslateBatch(messages, targetLang)
    }

    /**
     * 检查连接
     */
    async checkConnection(): Promise<boolean> {
        const url = this.buildRequestUrl()

        // DEEPL/DEEPLX 测试
        if (
            this.provider === AiModel_Platform_Enum.DEEPL ||
            this.provider === AiModel_Platform_Enum.DEEPLX
        ) {
            const testData = this.buildTranslationEngineConfig(
                [{ role: "user", content: "Hello" }],
                "zh-CN"
            )

            const response = await axios.post<unknown, Response<unknown>>(
                url,
                testData.config,
                {
                    headers: this.buildHeaders(),
                    timeout: UniversalTranslator.timeout
                }
            )

            const result = this.parseTranslationEngineResponse(response.data)
            return result.length > 0
        }

        // 其他 AI 提供商测试
        const testMessages = [
            { role: "user", content: "请返回 'OK' 确认连接正常" }
        ]
        const requestBody = this.buildAiRequestConfig(testMessages)

        // 剥离内部字段（apiKey/baseUrl/headers/timeout），只发送 API 需要的字段
        const {
            apiKey: _,
            baseUrl: _u,
            headers: _h,
            timeout: _t,
            ...apiPayload
        } = requestBody.config

        const response = await axios.post<unknown, Response<unknown>>(
            url,
            apiPayload,
            {
                headers: this.buildHeaders(),
                timeout: UniversalTranslator.timeout
            }
        )

        return this.parseAiResponse(response.data).includes("OK")
    }

    // ========================================================================
    // 第三部分：请求中断器
    // ========================================================================

    /**
     * 中断所有翻译请求
     */
    public abortAllTranslations(): void {
        void sendMessage("translate-request", {
            type: RequestType.ABORT,
            config: null
        }).catch(() => {})
    }

    /**
     * 生成页面内容摘要
     * @param title 页面标题
     * @param textContent 页面正文内容
     * @returns 生成的摘要文本，失败时返回空字符串
     */
    public async buildAiSummary(
        title: string,
        textContent: string
    ): Promise<string> {
        // 清理文本
        const cleanedText = textContent.trim()
        if (!cleanedText) {
            console.warn("[UniversalTranslator] 内容为空，跳过摘要生成")
            return ""
        }

        // 限制内容长度（最多 5000 字符）
        const MAX_CONTENT_LENGTH = 5000
        const truncatedContent =
            cleanedText.length > MAX_CONTENT_LENGTH
                ? cleanedText.slice(0, MAX_CONTENT_LENGTH) + "..."
                : cleanedText

        // 构建摘要生成提示词
        const prompt = `Summarize the following article in 2-3 sentences. Focus on the main topic and key points. Return ONLY the summary, no explanations or formatting.

Title: ${title}

Content:
${truncatedContent}`

        try {
            // 构建请求消息
            const messages: Message[] = [
                {
                    role: "user",
                    content: prompt
                }
            ]

            // 直接调用 sendRequest 获取摘要
            const requestBody = this.buildAiRequestConfig(messages)
            const response = await this.sendRequest(requestBody)

            const summary = this.parseAiResponse(response.content)

            if (!summary) {
                console.warn("[UniversalTranslator] 摘要生成返回空内容")
                return ""
            }

            return summary.trim()
        } catch (error) {
            console.error("[UniversalTranslator] 生成摘要失败:", error.message)
            return ""
        }
    }
}
