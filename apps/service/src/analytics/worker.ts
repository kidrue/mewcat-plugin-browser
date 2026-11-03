import {
    AnalysisError,
    createAnalyzer,
    type AnalysisResult
} from "./analyzer.js"
import { claimJob, failJob, finishJob } from "./jobs.js"
import type { AnalyticsStore } from "./store.js"

export type Analyzer = (
    text: string,
    signal?: AbortSignal
) => Promise<AnalysisResult>
export async function runAnalysisBatch(
    analytics: AnalyticsStore,
    analyzer: Analyzer = createAnalyzer(analytics.config),
    options: { limit: number; signal?: AbortSignal }
) {
    let attempted = 0
    let succeeded = 0
    while (attempted < options.limit && !options.signal?.aborted) {
        const job = await claimJob(analytics)
        if (!job) break
        attempted++
        try {
            const result = await analyzer(job.text, options.signal)
            if (await finishJob(analytics, job, result)) succeeded++
        } catch (error) {
            await failJob(
                analytics,
                job,
                error instanceof AnalysisError
                    ? error
                    : { code: "ANALYSIS_INTERNAL_ERROR", retryable: false }
            )
        }
    }
    return { attempted, succeeded }
}

export function startAnalysisWorker(
    analytics: AnalyticsStore,
    onError: () => void
) {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let active: Promise<void> = Promise.resolve()
    const tick = () => {
        active = runAnalysisBatch(analytics, createAnalyzer(analytics.config), {
            limit: 1,
            signal: controller.signal
        })
            .then(() => {}, onError)
            .finally(() => {
                if (!controller.signal.aborted) {
                    timer = setTimeout(tick, analytics.config.ANALYTICS_POLL_MS)
                    timer.unref()
                }
            })
    }
    if (analytics.config.ANALYTICS_AUTO_ANALYZE) tick()
    return async () => {
        controller.abort()
        if (timer) clearTimeout(timer)
        await active
    }
}
