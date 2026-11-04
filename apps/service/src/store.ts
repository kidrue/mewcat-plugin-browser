import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { calculateJwkThumbprint, type JWK } from "jose"

import { ApiError } from "./errors.js"
import { Prisma, PrismaClient } from "./generated/prisma/client.js"

export interface Bucket {
    key: string
    amount: number
    limit: number
    expiresAt: Date
    errorCode?: "QUOTA_EXCEEDED" | "RATE_LIMITED"
}
type Tx = Prisma.TransactionClient

function bucketError(bucket: Bucket): ApiError {
    const code = bucket.errorCode ?? "QUOTA_EXCEEDED"
    return new ApiError(
        429,
        code,
        code === "RATE_LIMITED"
            ? "请求过于频繁，请稍后重试"
            : "已达到当前时段的使用限额"
    )
}

async function consume(tx: Tx, buckets: Bucket[]) {
    for (const bucket of buckets) {
        if (
            !Number.isSafeInteger(bucket.amount) ||
            bucket.amount <= 0 ||
            !Number.isSafeInteger(bucket.limit) ||
            bucket.limit < bucket.amount
        ) {
            throw bucketError(bucket)
        }
        await tx.usageBucket.upsert({
            where: { key: bucket.key },
            create: { key: bucket.key, used: 0, expiresAt: bucket.expiresAt },
            update: {}
        })
        const result = await tx.usageBucket.updateMany({
            where: {
                key: bucket.key,
                used: { lte: bucket.limit - bucket.amount }
            },
            data: { used: { increment: bucket.amount } }
        })
        if (result.count !== 1) throw bucketError(bucket)
    }
}

async function activeClient(tx: Tx, id: string) {
    const client = await tx.client.findUnique({ where: { id } })
    if (!client) throw new ApiError(401, "UNAUTHORIZED", "客户端身份无效")
    if (client.revokedAt)
        throw new ApiError(403, "CLIENT_REVOKED", "客户端已被停用")
    return client
}

export class Store {
    readonly db: PrismaClient
    // SQLite 部署使用单个进程。队列避免同连接上交叠事务；数据库条件更新仍负责额度约束。
    private writes: Promise<unknown> = Promise.resolve()
    constructor(url: string) {
        this.db = new PrismaClient({
            adapter: new PrismaBetterSqlite3({ url })
        })
    }
    atomic<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
        const result = this.writes.then(() =>
            this.db.$transaction(work, { maxWait: 10_000, timeout: 10_000 })
        )
        this.writes = result.catch(() => undefined)
        return result
    }
    async registerClient(
        name: string,
        signing: JWK,
        encryption: JWK,
        registrationBuckets: Bucket[] = []
    ) {
        const keyThumbprint = await calculateJwkThumbprint(signing)
        try {
            return await this.atomic(async tx => {
                const existing = await tx.client.findUnique({
                    where: { keyThumbprint }
                })
                if (existing) {
                    if (existing.revokedAt)
                        throw new ApiError(
                            403,
                            "CLIENT_REVOKED",
                            "客户端已被停用"
                        )
                    if (
                        (await calculateJwkThumbprint(
                            JSON.parse(existing.encryptionKey)
                        )) === (await calculateJwkThumbprint(encryption))
                    )
                        return existing
                    throw new ApiError(
                        409,
                        "CLIENT_EXISTS",
                        "该设备密钥已注册，但响应公钥不匹配"
                    )
                }
                await consume(tx, registrationBuckets)
                return tx.client.create({
                    data: {
                        name,
                        signingKey: JSON.stringify(signing),
                        encryptionKey: JSON.stringify(encryption),
                        keyThumbprint
                    }
                })
            })
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            )
                throw new ApiError(409, "CLIENT_EXISTS", "该设备密钥已注册")
            throw error
        }
    }
    async revokeClient(id: string): Promise<void> {
        await this.atomic(async tx => {
            await tx.client.update({
                where: { id },
                data: { revokedAt: new Date() }
            })
        })
    }
    async consumeNonce(
        id: string,
        nonce: string,
        expiresAt: number
    ): Promise<void> {
        try {
            await this.atomic(async tx => {
                await activeClient(tx, id)
                await tx.nonce.create({
                    data: {
                        clientId: id,
                        value: nonce,
                        expiresAt: new Date(expiresAt)
                    }
                })
            })
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            )
                throw new ApiError(
                    409,
                    "REPLAY_DETECTED",
                    "请求已处理，请勿重放"
                )
            throw error
        }
    }
    async consumeBuckets(buckets: Bucket[]): Promise<void> {
        await this.atomic(tx => consume(tx, buckets))
    }
    async reserveTranslation(
        clientId: string,
        characters: number,
        buckets: Bucket[],
        details: {
            sourceLanguage?: string
            targetLanguage?: string
            segmentCount?: number
            model?: string
        } = {},
        persist?: (tx: Tx, id: string) => Promise<void>
    ) {
        return this.atomic(async tx => {
            await activeClient(tx, clientId)
            await consume(tx, buckets)
            const record = await tx.translationRequest.create({
                data: {
                    clientId,
                    inputCharacters: characters,
                    sourceLanguage: details.sourceLanguage ?? null,
                    targetLanguage: details.targetLanguage ?? null,
                    segmentCount: details.segmentCount ?? null,
                    model: details.model ?? null
                }
            })
            await persist?.(tx, record.id)
            return record
        })
    }
    async finishTranslation(
        id: string,
        status: "success" | "failed",
        promptTokens: number | null = null,
        completionTokens: number | null = null,
        details: { errorCode?: string; upstreamDurationMs?: number } = {},
        persist?: (tx: Tx) => Promise<void>
    ): Promise<void> {
        await this.atomic(async tx => {
            const updated = await tx.translationRequest.updateMany({
                where: { id, status: "pending" },
                data: {
                    status,
                    promptTokens,
                    completionTokens,
                    completedAt: new Date(),
                    ...details
                }
            })
            if (updated.count) await persist?.(tx)
        })
    }
    async used(key: string): Promise<number> {
        return (
            (await this.db.usageBucket.findUnique({ where: { key } }))?.used ??
            0
        )
    }
    async cleanup(now = Date.now(), retentionDays = 30) {
        return this.atomic(async tx => ({
            nonces: (
                await tx.nonce.deleteMany({
                    where: { expiresAt: { lt: new Date(now) } }
                })
            ).count,
            buckets: (
                await tx.usageBucket.deleteMany({
                    where: { expiresAt: { lt: new Date(now) } }
                })
            ).count,
            requests: (
                await tx.translationRequest.deleteMany({
                    where: {
                        createdAt: {
                            lt: new Date(now - retentionDays * 86_400_000)
                        }
                    }
                })
            ).count
        }))
    }
}
export const createStore = (url: string): Store => new Store(url)
