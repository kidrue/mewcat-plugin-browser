import { useCallback, useEffect, useRef, useState } from "react"

import type { ConceptExplanationInput } from "@/translation/modelTranslation"
import {
    streamConceptExplanation,
    type TranslationRuntimeConfig
} from "@/translation/translationService"

interface ExplanationState {
    loading: boolean
    value?: string
    error?: unknown
}

export function useConceptExplanation(
    config: TranslationRuntimeConfig,
    input: ConceptExplanationInput,
    targetLanguage: string,
    active: boolean
) {
    const [state, setState] = useState<ExplanationState>({ loading: false })
    const current = useRef<AbortController>()
    const { text, pageTitle, context } = input
    const cancel = useCallback(() => {
        current.current?.abort()
        current.current = undefined
    }, [])

    useEffect(() => {
        cancel()
        setState({ loading: false })
        return cancel
    }, [cancel, config, context, pageTitle, targetLanguage, text])

    useEffect(() => {
        if (!active) {
            cancel()
            setState(previous =>
                previous.loading ? { ...previous, loading: false } : previous
            )
        }
    }, [active, cancel])

    const request = useCallback(async () => {
        if (!text || !active || current.current) return
        const controller = new AbortController()
        current.current = controller
        const isCurrent = () =>
            current.current === controller && !controller.signal.aborted
        let accumulated = ""
        setState({ loading: true })
        try {
            const value = await streamConceptExplanation(
                config,
                { text, pageTitle, context },
                targetLanguage,
                {
                    signal: controller.signal,
                    onDelta: delta => {
                        if (!isCurrent()) return
                        accumulated += delta
                        setState({ loading: true, value: accumulated })
                    }
                }
            )
            if (isCurrent()) setState({ loading: false, value })
        } catch (error) {
            if (isCurrent())
                setState({ loading: false, value: accumulated, error })
        } finally {
            if (current.current === controller) current.current = undefined
        }
    }, [active, config, context, pageTitle, targetLanguage, text])

    return [state, request] as const
}
