import { randomUUID } from "node:crypto"

import type { AnalysisResult } from "./analyzer.js"
import {
    ANALYSIS_VERSION,
    DAY_MS,
    utcDay,
    type AnalyticsStore
} from "./store.js"

export interface ClaimedJob {
    id: string
    requestId: string
    clientId: string
    epoch: number
    version: string
    leaseToken: string
    text: string
    originalCharacters: number
    sampledCharacters: number
    truncated: boolean
}

export async function claimJob(
    analytics: AnalyticsStore,
    now = Date.now()
): Promise<ClaimedJob | null> {
    if (!analytics.cipher) return null
    return analytics.store.atomic(async tx => {
        await tx.analysisJob.updateMany({
            where: {
                status: "running",
                leaseExpiresAt: { lte: new Date(now) },
                attempts: { gte: 3 }
            },
            data: {
                status: "failed",
                errorCode: "ANALYSIS_LEASE_EXPIRED",
                leaseToken: null,
                leaseExpiresAt: null
            }
        })
        // 有界扫描，跳过已过期内容后继续处理后续任务。
        const jobs = await tx.analysisJob.findMany({
            where: {
                version: ANALYSIS_VERSION,
                attempts: { lt: 3 },
                OR: [
                    {
                        status: "pending",
                        nextAttemptAt: { lte: new Date(now) }
                    },
                    {
                        status: "running",
                        leaseExpiresAt: { lte: new Date(now) }
                    }
                ]
            },
            orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
            take: 50
        })
        for (const job of jobs) {
            const content = await tx.translationContent.findUnique({
                where: { requestId: job.requestId },
                include: { request: true }
            })
            if (
                !content ||
                content.expiresAt.getTime() <= now ||
                !(await analytics.current(tx, job.clientId, job.epoch))
            ) {
                await tx.analysisJob.update({
                    where: { id: job.id },
                    data: {
                        status: "expired",
                        leaseToken: null,
                        leaseExpiresAt: null
                    }
                })
                continue
            }
            let original: string[]
            try {
                original = analytics.cipher!.decrypt(
                    job.requestId,
                    "original",
                    content.original
                )
            } catch {
                await tx.analysisJob.update({
                    where: { id: job.id },
                    data: {
                        status: "failed",
                        errorCode: "CONTENT_DECRYPT_FAILED"
                    }
                })
                continue
            }
            const joined = original.join("\n")
            const text = joined.slice(
                0,
                analytics.config.ANALYTICS_SAMPLE_CHARACTERS
            )
            const budgets = [
                {
                    key: `analysis:attempts:${utcDay(now)}`,
                    amount: 1,
                    limit: analytics.config.ANALYTICS_DAILY_ATTEMPTS
                },
                {
                    key: `analysis:characters:${utcDay(now)}`,
                    amount: text.length,
                    limit: analytics.config.ANALYTICS_DAILY_CHARACTERS
                }
            ]
            let allowed = true
            for (const budget of budgets) {
                const used =
                    (
                        await tx.usageBucket.findUnique({
                            where: { key: budget.key }
                        })
                    )?.used ?? 0
                if (used + budget.amount > budget.limit) allowed = false
            }
            if (!allowed) {
                await tx.analysisJob.update({
                    where: { id: job.id },
                    data: {
                        status: "pending",
                        leaseToken: null,
                        leaseExpiresAt: null,
                        nextAttemptAt: new Date(
                            Date.parse(`${utcDay(now)}T00:00:00Z`) + DAY_MS
                        )
                    }
                })
                continue
            }
            for (const budget of budgets)
                await tx.usageBucket.upsert({
                    where: { key: budget.key },
                    create: {
                        key: budget.key,
                        used: budget.amount,
                        expiresAt: new Date(now + 2 * DAY_MS)
                    },
                    update: { used: { increment: budget.amount } }
                })
            const leaseToken = randomUUID()
            await tx.analysisJob.update({
                where: { id: job.id },
                data: {
                    status: "running",
                    attempts: { increment: 1 },
                    leaseToken,
                    leaseExpiresAt: new Date(
                        now + analytics.config.ANALYTICS_TIMEOUT_MS + 30_000
                    ),
                    errorCode: null
                }
            })
            return {
                id: job.id,
                requestId: job.requestId,
                clientId: job.clientId,
                epoch: job.epoch,
                version: job.version,
                leaseToken,
                text,
                originalCharacters: original.reduce(
                    (sum, value) => sum + value.length,
                    0
                ),
                sampledCharacters: text.length,
                truncated: text.length < joined.length
            }
        }
        return null
    })
}

export async function finishJob(
    analytics: AnalyticsStore,
    job: ClaimedJob,
    result: AnalysisResult,
    now = Date.now()
) {
    return analytics.store.atomic(async tx => {
        const current = await tx.analysisJob.findUnique({
            where: { id: job.id }
        })
        if (
            !current ||
            current.status !== "running" ||
            current.leaseToken !== job.leaseToken ||
            !current.leaseExpiresAt ||
            current.leaseExpiresAt.getTime() <= now ||
            !(await analytics.current(tx, job.clientId, job.epoch))
        )
            return false
        const content = await tx.translationContent.findUnique({
            where: { requestId: job.requestId },
            include: { request: true }
        })
        if (!content || content.expiresAt.getTime() <= now) {
            await tx.analysisJob.update({
                where: { id: job.id },
                data: {
                    status: "expired",
                    leaseToken: null,
                    leaseExpiresAt: null
                }
            })
            return false
        }
        await tx.contentAnalysis.create({
            data: {
                requestId: job.requestId,
                requestCreatedAt: content.request.createdAt,
                clientId: job.clientId,
                version: job.version,
                topics: JSON.stringify(result.topics),
                keywords: JSON.stringify(result.keywords),
                model: analytics.config.SILICONFLOW_MODEL,
                originalCharacters: job.originalCharacters,
                sampledCharacters: job.sampledCharacters,
                truncated: job.truncated,
                promptTokens: result.promptTokens,
                completionTokens: result.completionTokens,
                createdAt: new Date(now)
            }
        })
        const key = {
            clientId: job.clientId,
            day: utcDay(content.request.createdAt),
            version: job.version,
            digest: content.digest
        }
        if (
            !(await tx.topicSample.findUnique({
                where: { clientId_day_version_digest: key }
            }))
        ) {
            await tx.topicSample.create({ data: key })
            for (const topic of result.topics) {
                const topicKey = {
                    clientId: key.clientId,
                    day: key.day,
                    version: key.version,
                    topic: topic.topic
                }
                await tx.topicDaily.upsert({
                    where: { clientId_day_version_topic: topicKey },
                    create: {
                        ...topicKey,
                        samples: 1n,
                        score: topic.confidence
                    },
                    update: {
                        samples: { increment: 1n },
                        score: { increment: topic.confidence }
                    }
                })
            }
        }
        await tx.analysisJob.update({
            where: { id: job.id },
            data: {
                status: "succeeded",
                leaseToken: null,
                leaseExpiresAt: null
            }
        })
        return true
    })
}

export async function failJob(
    analytics: AnalyticsStore,
    job: ClaimedJob,
    error: { code: string; retryable: boolean },
    now = Date.now()
) {
    await analytics.store.atomic(async tx => {
        const current = await tx.analysisJob.findUnique({
            where: { id: job.id }
        })
        if (
            !current ||
            current.status !== "running" ||
            current.leaseToken !== job.leaseToken
        )
            return
        await tx.analysisJob.update({
            where: { id: job.id },
            data: {
                status:
                    error.retryable && current.attempts < 3
                        ? "pending"
                        : "failed",
                errorCode: error.code,
                nextAttemptAt: new Date(now + 5000 * 2 ** current.attempts),
                leaseToken: null,
                leaseExpiresAt: null
            }
        })
    })
}

export async function retryJobs(analytics: AnalyticsStore, clientId?: string) {
    return analytics.store.atomic(tx =>
        tx.analysisJob.updateMany({
            where: {
                status: "failed",
                attempts: { lt: 3 },
                ...(clientId ? { clientId } : {})
            },
            data: {
                status: "pending",
                nextAttemptAt: new Date(),
                errorCode: null
            }
        })
    )
}
