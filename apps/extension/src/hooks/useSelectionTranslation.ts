import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { ConceptExplanationInput } from "@/translation/modelTranslation"
import { parseSelectionAnalysis } from "@/translation/selectionAnalysis"
import { translateSelectedText } from "@/translation/selectionTranslation"
import {
    isConfiguredGenerativeModel,
    streamConceptExplanation,
    translateText,
    type TranslationRuntimeConfig
} from "@/translation/translationService"

export interface SelectionResult {
    mode: "analyzing" | "translate" | "explain"
    value: string
    loading: boolean
    notice?: string
    error?: string
}

export function useSelectionTranslation(
    config: TranslationRuntimeConfig,
    { text, pageTitle, context }: ConceptExplanationInput,
    targetLanguage: string,
    active: boolean
) {
    const request = useMemo(
        () => ({
            config,
            text,
            pageTitle,
            context,
            targetLanguage,
            active,
            initial: {
                mode: "analyzing",
                value: "",
                loading: active && !!text
            } as SelectionResult
        }),
        [config, text, pageTitle, context, targetLanguage, active]
    )
    const [snapshot, setSnapshot] = useState({
        request,
        result: request.initial
    })
    const retryTranslation = useRef<() => void>()

    useEffect(() => {
        const controller = new AbortController()
        const { signal } = controller
        const publish = (result: SelectionResult) => {
            if (!signal.aborted) setSnapshot({ request, result })
        }
        retryTranslation.current = undefined
        publish(request.initial)
        if (!active || !text) return () => controller.abort()

        let translating = false
        const translate = async (notice?: string) => {
            if (signal.aborted || translating) return
            translating = true
            retryTranslation.current = () => void translate(notice)
            publish({ mode: "translate", value: "", loading: true, notice })
            try {
                const value = await translateSelectedText(
                    {
                        translateText: (messages, language) =>
                            translateText(config, messages, language)
                    },
                    text,
                    { targetLanguage }
                )
                if (!value.trim())
                    throw new Error("Empty selection translation")
                publish({ mode: "translate", value, loading: false, notice })
            } catch {
                publish({
                    mode: "translate",
                    value: "",
                    loading: false,
                    notice,
                    error: "翻译失败，请稍后重试"
                })
            } finally {
                translating = false
            }
        }

        const run = async () => {
            if (!config.aiModelList.some(isConfiguredGenerativeModel)) {
                await translate("配置 AI 模型后可自动解释术语")
                return
            }
            let accumulated = ""
            try {
                const response = await streamConceptExplanation(
                    config,
                    { text, pageTitle, context, detectTerms: true },
                    targetLanguage,
                    {
                        signal,
                        onDelta: delta => {
                            if (signal.aborted) return
                            accumulated += delta
                            const parsed = parseSelectionAnalysis(accumulated)
                            if (parsed.mode === "explain" && parsed.value) {
                                publish({ ...parsed, loading: true })
                            }
                        }
                    }
                )
                if (signal.aborted) return
                const parsed = parseSelectionAnalysis(response, true)
                if (parsed.mode === "explain") {
                    publish({ ...parsed, loading: false })
                } else {
                    await translate()
                }
            } catch {
                if (!signal.aborted)
                    await translate("术语解释暂不可用，已使用普通翻译")
            }
        }
        void run()
        return () => controller.abort()
    }, [request, active, config, text, pageTitle, context, targetLanguage])

    const retry = useCallback(() => retryTranslation.current?.(), [])
    return {
        result:
            snapshot.request === request ? snapshot.result : request.initial,
        retry
    }
}
