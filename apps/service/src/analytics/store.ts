import type { Config } from "../config.js"
import type { Prisma } from "../generated/prisma/client.js"
import type { Store } from "../store.js"
import { createContentCipher } from "./content.js"

export const ANALYSIS_VERSION = "topics-v1"
export const DAY_MS = 86_400_000
export const utcDay = (time: Date | number) =>
    new Date(time).toISOString().slice(0, 10)
export type Tx = Prisma.TransactionClient
export interface CallInput {
    id: string
    requestId: string
    route: string
    method: string
    clientId?: string
    createdAt: Date
    completedAt: Date
    statusCode: number
    errorCode?: string
    durationMs: number
    translationRequestId?: string
    epoch?: number
}

export class AnalyticsStore {
    readonly cipher: ReturnType<typeof createContentCipher> | undefined
    persistenceFailures = 0
    constructor(
        readonly store: Store,
        readonly config: Config
    ) {
        this.cipher = config.ANALYTICS_CAPTURE_CONTENT
            ? createContentCipher(config.ANALYTICS_CONTENT_KEY)
            : undefined
    }
    async epoch(clientId: string) {
        return this.store.atomic(
            async tx =>
                (
                    await tx.analyticsIdentity.upsert({
                        where: { clientId },
                        create: { clientId },
                        update: {}
                    })
                ).epoch
        )
    }
    async current(tx: Tx, clientId: string, epoch: number) {
        return (
            (await tx.analyticsIdentity.findUnique({ where: { clientId } }))
                ?.epoch === epoch
        )
    }
    async capture(
        tx: Tx,
        requestId: string,
        clientId: string,
        epoch: number,
        texts: string[]
    ) {
        if (!this.cipher || !(await this.current(tx, clientId, epoch))) return
        await tx.translationContent.create({
            data: {
                requestId,
                original: this.cipher.encrypt(requestId, "original", texts),
                digest: this.cipher.digest(texts),
                expiresAt: new Date(
                    Date.now() +
                        this.config.ANALYTICS_CONTENT_RETENTION_DAYS * DAY_MS
                )
            }
        })
    }
    async complete(
        tx: Tx,
        requestId: string,
        clientId: string,
        epoch: number,
        translations?: string[]
    ) {
        if (!this.cipher || !(await this.current(tx, clientId, epoch))) return
        const content = await tx.translationContent.findUnique({
            where: { requestId },
            include: { request: true }
        })
        if (!content || content.expiresAt.getTime() <= Date.now()) return
        if (translations)
            await tx.translationContent.update({
                where: { requestId },
                data: {
                    translated: this.cipher.encrypt(
                        requestId,
                        "translated",
                        translations
                    )
                }
            })
        await tx.analysisJob.upsert({
            where: {
                requestId_version: { requestId, version: ANALYSIS_VERSION }
            },
            create: {
                requestId,
                clientId,
                epoch,
                version: ANALYSIS_VERSION,
                createdAt: content.request.createdAt
            },
            update: {}
        })
    }
    async readContent(requestId: string, now = Date.now()) {
        const content = await this.store.db.translationContent.findUnique({
            where: { requestId }
        })
        if (!content || content.expiresAt.getTime() <= now || !this.cipher)
            return null
        return {
            original: this.cipher.decrypt(
                requestId,
                "original",
                content.original
            ),
            translated: content.translated
                ? this.cipher.decrypt(
                      requestId,
                      "translated",
                      content.translated
                  )
                : null,
            digest: content.digest
        }
    }
    async recordCall(input: CallInput) {
        await this.store.atomic(async tx => {
            if (
                input.clientId &&
                input.epoch !== undefined &&
                !(await this.current(tx, input.clientId, input.epoch))
            )
                return
            if (await tx.apiCall.findUnique({ where: { id: input.id } })) return
            const { epoch: _epoch, ...data } = input
            await tx.apiCall.create({ data })
            const execution = input.translationRequestId
                ? await tx.translationRequest.findUnique({
                      where: { id: input.translationRequestId }
                  })
                : null
            const dimensions: Array<[string, string]> = [
                ["route", input.route],
                ["hour", String(input.createdAt.getUTCHours())]
            ]
            if (input.errorCode) dimensions.push(["error", input.errorCode])
            if (execution?.targetLanguage)
                dimensions.push([
                    "language",
                    JSON.stringify([
                        execution.sourceLanguage,
                        execution.targetLanguage
                    ])
                ])
            const values = {
                requests: 1n,
                successes: input.statusCode < 400 ? 1n : 0n,
                failures: input.statusCode >= 400 ? 1n : 0n,
                rejected:
                    input.statusCode >= 400 && input.statusCode < 500 ? 1n : 0n,
                executions: execution ? 1n : 0n,
                characters: BigInt(execution?.inputCharacters ?? 0),
                promptTokens: BigInt(execution?.promptTokens ?? 0),
                completionTokens: BigInt(execution?.completionTokens ?? 0),
                durationMs: input.durationMs
            }
            const increments = Object.fromEntries(
                Object.entries(values).map(([key, value]) => [
                    key,
                    { increment: value }
                ])
            )
            for (const [dimension, value] of dimensions) {
                const key = {
                    clientId: input.clientId ?? "",
                    day: utcDay(input.createdAt),
                    dimension,
                    value
                }
                await tx.analyticsDaily.upsert({
                    where: { clientId_day_dimension_value: key },
                    create: { ...key, ...values },
                    update: increments
                })
            }
        })
    }
    async purge(clientId: string) {
        return this.store.atomic(async tx => {
            await tx.analyticsIdentity.upsert({
                where: { clientId },
                create: { clientId, epoch: 1 },
                update: { epoch: { increment: 1 } }
            })
            const counts = {
                jobs: (await tx.analysisJob.deleteMany({ where: { clientId } }))
                    .count,
                analyses: (
                    await tx.contentAnalysis.deleteMany({ where: { clientId } })
                ).count,
                topics: (
                    await tx.topicDaily.deleteMany({ where: { clientId } })
                ).count,
                samples: (
                    await tx.topicSample.deleteMany({ where: { clientId } })
                ).count,
                aggregates: (
                    await tx.analyticsDaily.deleteMany({ where: { clientId } })
                ).count,
                calls: (await tx.apiCall.deleteMany({ where: { clientId } }))
                    .count,
                requests: (
                    await tx.translationRequest.deleteMany({
                        where: { clientId }
                    })
                ).count
            }
            return counts
        })
    }
    async cleanup(now = Date.now()) {
        return this.store.atomic(async tx => {
            const cutoff = new Date(
                now - this.config.ANALYTICS_CALL_RETENTION_DAYS * DAY_MS
            )
            // 待分析内容到期和历史请求清理前先作废任务，不留下永久 pending。
            const stale = await tx.analysisJob.findMany({
                where: { status: { in: ["pending", "running"] } },
                select: { id: true, requestId: true }
            })
            for (const job of stale) {
                const content = await tx.translationContent.findUnique({
                    where: { requestId: job.requestId }
                })
                if (!content || content.expiresAt.getTime() <= now)
                    await tx.analysisJob.update({
                        where: { id: job.id },
                        data: {
                            status: "expired",
                            leaseToken: null,
                            leaseExpiresAt: null
                        }
                    })
            }
            const day = utcDay(
                now - this.config.ANALYTICS_AGGREGATE_RETENTION_DAYS * DAY_MS
            )
            return {
                contents: (
                    await tx.translationContent.deleteMany({
                        where: { expiresAt: { lte: new Date(now) } }
                    })
                ).count,
                calls: (
                    await tx.apiCall.deleteMany({
                        where: { createdAt: { lt: cutoff } }
                    })
                ).count,
                analyses: (
                    await tx.contentAnalysis.deleteMany({
                        where: { createdAt: { lt: cutoff } }
                    })
                ).count,
                jobs: (
                    await tx.analysisJob.deleteMany({
                        where: { createdAt: { lt: cutoff } }
                    })
                ).count,
                requests: (
                    await tx.translationRequest.deleteMany({
                        where: { createdAt: { lt: cutoff } }
                    })
                ).count,
                aggregates: (
                    await tx.analyticsDaily.deleteMany({
                        where: { day: { lt: day } }
                    })
                ).count,
                topics: (
                    await tx.topicDaily.deleteMany({
                        where: { day: { lt: day } }
                    })
                ).count,
                samples: (
                    await tx.topicSample.deleteMany({
                        where: { day: { lt: day } }
                    })
                ).count
            }
        })
    }
}
