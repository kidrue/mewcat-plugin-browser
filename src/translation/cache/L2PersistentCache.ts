/**
 * L2 持久化缓存（IndexedDB）
 * 提供跨页面、跨会话的持久化缓存
 */

import { STORAGE_NAMES } from "@/constants/storage"

import { generateCacheKey } from "./cacheKeyGenerator"
import type { CacheEntry, CacheKeyParams, CacheStats } from "./types"

/**
 * L2 持久化缓存配置
 */
export interface L2CacheConfig {
    /** 数据库名称 */
    dbName?: string
    /** 存储名称 */
    storeName?: string
    /** 数据库版本 */
    version?: number
}

/**
 * L2 持久化缓存类
 * 使用 IndexedDB 实现持久化存储
 */
export class L2PersistentCache {
    private readonly dbName: string
    private readonly storeName: string
    private readonly version: number
    private db: IDBDatabase | null = null
    private initPromise: Promise<void> | null = null

    constructor(config: L2CacheConfig = {}) {
        this.dbName = config.dbName ?? STORAGE_NAMES.translationCacheDatabase
        this.storeName = config.storeName ?? "translations"
        this.version = config.version ?? 1
    }

    /**
     * 初始化数据库
     * @returns Promise
     */
    async init(): Promise<void> {
        // 如果已经初始化过，返回之前的 Promise
        if (this.initPromise) {
            return this.initPromise
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version)

            request.onerror = () => {
                console.error(
                    "[L2Cache] Failed to open database:",
                    request.error
                )
                reject(request.error)
            }

            request.onsuccess = () => {
                this.db = request.result
                resolve()
            }

            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result

                // 如果存储已存在，先删除
                if (db.objectStoreNames.contains(this.storeName)) {
                    db.deleteObjectStore(this.storeName)
                }

                // 创建对象存储
                const store = db.createObjectStore(this.storeName, {
                    keyPath: "key"
                })

                // 创建索引以支持高效查询
                store.createIndex("targetLang", "targetLang", { unique: false })
                store.createIndex("modelId", "modelId", { unique: false })
                store.createIndex("createdAt", "createdAt", { unique: false })
                store.createIndex("lastAccessTime", "lastAccessTime", {
                    unique: false
                })
                store.createIndex("hitCount", "hitCount", { unique: false })
                store.createIndex("expiresAt", "expiresAt", { unique: false })
            }
        })

        return this.initPromise
    }

    /**
     * 确保数据库已初始化
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.db) {
            await this.init()
        }
    }

    /**
     * 获取缓存
     * @param params 缓存键参数
     * @returns 翻译结果，未找到返回 null
     */
    async get(params: CacheKeyParams): Promise<string | null> {
        await this.ensureInitialized()

        if (!this.db) {
            return null
        }

        const key = await generateCacheKey(params)

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readonly"
            )
            const store = transaction.objectStore(this.storeName)
            const request = store.get(key)

            request.onsuccess = () => {
                const entry = request.result as CacheEntry | undefined

                if (!entry) {
                    resolve(null)
                    return
                }

                // 检查是否过期
                if (entry.expiresAt && Date.now() > entry.expiresAt) {
                    // 异步删除过期条目
                    this.delete(params).catch(() => {})
                    resolve(null)
                    return
                }

                // 异步更新访问时间和命中次数
                this.updateAccessInfo(key).catch(() => {})

                resolve(entry.translation)
            }

            request.onerror = () => {
                console.error("[L2Cache] Failed to get cache:", request.error)
                resolve(null)
            }
        })
    }

    /**
     * 设置缓存
     * @param params 缓存键参数
     * @param translation 翻译结果
     * @param ttl 过期时间（毫秒），可选
     */
    async set(
        params: CacheKeyParams,
        translation: string,
        ttl?: number
    ): Promise<void> {
        await this.ensureInitialized()

        if (!this.db) {
            return
        }

        const key = await generateCacheKey(params)
        const now = Date.now()

        const entry: CacheEntry = {
            key,
            text: params.text,
            translation,
            sourceLang: params.sourceLang,
            targetLang: params.targetLang,
            modelId: params.modelId,
            aiRole: params.aiRole || "default",
            context: params.context,
            createdAt: now,
            lastAccessTime: now,
            expiresAt: ttl ? now + ttl : null,
            hitCount: 0
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readwrite"
            )
            const store = transaction.objectStore(this.storeName)
            const request = store.put(entry)

            request.onsuccess = () => resolve()
            request.onerror = () => {
                console.error("[L2Cache] Failed to set cache:", request.error)
                reject(request.error)
            }
        })
    }

    /**
     * 更新访问信息（访问时间和命中次数）
     * @param key 缓存键
     */
    private async updateAccessInfo(key: string): Promise<void> {
        if (!this.db) {
            return
        }

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readwrite"
            )
            const store = transaction.objectStore(this.storeName)
            const getRequest = store.get(key)

            getRequest.onsuccess = () => {
                const entry = getRequest.result as CacheEntry | undefined
                if (entry) {
                    entry.lastAccessTime = Date.now()
                    entry.hitCount++
                    store.put(entry)
                }
                resolve()
            }

            getRequest.onerror = () => resolve()
        })
    }

    /**
     * 检查缓存是否存在
     * @param params 缓存键参数
     * @returns 是否存在
     */
    async has(params: CacheKeyParams): Promise<boolean> {
        const result = await this.get(params)
        return result !== null
    }

    /**
     * 删除缓存
     * @param params 缓存键参数
     * @returns 是否删除成功
     */
    async delete(params: CacheKeyParams): Promise<boolean> {
        await this.ensureInitialized()

        if (!this.db) {
            return false
        }

        const key = await generateCacheKey(params)

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readwrite"
            )
            const store = transaction.objectStore(this.storeName)
            const request = store.delete(key)

            request.onsuccess = () => resolve(true)
            request.onerror = () => {
                console.error(
                    "[L2Cache] Failed to delete cache:",
                    request.error
                )
                resolve(false)
            }
        })
    }

    /**
     * 清空所有缓存
     */
    async clear(): Promise<void> {
        await this.ensureInitialized()

        if (!this.db) {
            return
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readwrite"
            )
            const store = transaction.objectStore(this.storeName)
            const request = store.clear()

            request.onsuccess = () => resolve()
            request.onerror = () => {
                console.error("[L2Cache] Failed to clear cache:", request.error)
                reject(request.error)
            }
        })
    }

    /**
     * 获取缓存大小
     * @returns 缓存条目数量
     */
    async size(): Promise<number> {
        await this.ensureInitialized()

        if (!this.db) {
            return 0
        }

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readonly"
            )
            const store = transaction.objectStore(this.storeName)
            const request = store.count()

            request.onsuccess = () => resolve(request.result)
            request.onerror = () => {
                console.error("[L2Cache] Failed to get size:", request.error)
                resolve(0)
            }
        })
    }

    /**
     * 清理过期缓存
     * @returns 清理的条目数量
     */
    async cleanExpired(): Promise<number> {
        await this.ensureInitialized()

        if (!this.db) {
            return 0
        }

        const now = Date.now()
        let cleanedCount = 0

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readwrite"
            )
            const store = transaction.objectStore(this.storeName)
            const index = store.index("expiresAt")
            const request = index.openCursor()

            request.onsuccess = event => {
                const cursor = (event.target as IDBRequest).result
                if (cursor) {
                    const entry = cursor.value as CacheEntry
                    if (entry.expiresAt && now > entry.expiresAt) {
                        cursor.delete()
                        cleanedCount++
                    }
                    cursor.continue()
                } else {
                    resolve(cleanedCount)
                }
            }

            request.onerror = () => {
                console.error(
                    "[L2Cache] Failed to clean expired:",
                    request.error
                )
                resolve(cleanedCount)
            }
        })
    }

    /**
     * 清理旧缓存（基于创建时间）
     * @param maxAge 最大年龄（毫秒）
     * @returns 清理的条目数量
     */
    async cleanOld(maxAge: number): Promise<number> {
        await this.ensureInitialized()

        if (!this.db) {
            return 0
        }

        const cutoffTime = Date.now() - maxAge
        let cleanedCount = 0

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readwrite"
            )
            const store = transaction.objectStore(this.storeName)
            const index = store.index("createdAt")
            const request = index.openCursor()

            request.onsuccess = event => {
                const cursor = (event.target as IDBRequest).result
                if (cursor) {
                    const entry = cursor.value as CacheEntry
                    if (entry.createdAt < cutoffTime) {
                        cursor.delete()
                        cleanedCount++
                    }
                    cursor.continue()
                } else {
                    resolve(cleanedCount)
                }
            }

            request.onerror = () => {
                console.error("[L2Cache] Failed to clean old:", request.error)
                resolve(cleanedCount)
            }
        })
    }

    /**
     * 清理低频缓存（基于命中次数）
     * @param minHitCount 最小命中次数
     * @returns 清理的条目数量
     */
    async cleanLowFrequency(minHitCount: number): Promise<number> {
        await this.ensureInitialized()

        if (!this.db) {
            return 0
        }

        let cleanedCount = 0

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readwrite"
            )
            const store = transaction.objectStore(this.storeName)
            const request = store.openCursor()

            request.onsuccess = event => {
                const cursor = (event.target as IDBRequest).result
                if (cursor) {
                    const entry = cursor.value as CacheEntry
                    if (entry.hitCount < minHitCount) {
                        cursor.delete()
                        cleanedCount++
                    }
                    cursor.continue()
                } else {
                    resolve(cleanedCount)
                }
            }

            request.onerror = () => {
                console.error(
                    "[L2Cache] Failed to clean low frequency:",
                    request.error
                )
                resolve(cleanedCount)
            }
        })
    }

    /**
     * 清理超过最大容量的缓存（保留最近访问的）
     * @param maxSize 最大容量
     * @returns 清理的条目数量
     */
    async cleanOverCapacity(maxSize: number): Promise<number> {
        await this.ensureInitialized()

        if (!this.db) {
            return 0
        }

        const currentSize = await this.size()
        if (currentSize <= maxSize) {
            return 0
        }

        const toDelete = currentSize - maxSize
        let deletedCount = 0

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readwrite"
            )
            const store = transaction.objectStore(this.storeName)
            const index = store.index("lastAccessTime")
            const request = index.openCursor()

            request.onsuccess = event => {
                const cursor = (event.target as IDBRequest).result
                if (cursor && deletedCount < toDelete) {
                    cursor.delete()
                    deletedCount++
                    cursor.continue()
                } else {
                    resolve(deletedCount)
                }
            }

            request.onerror = () => {
                console.error(
                    "[L2Cache] Failed to clean over capacity:",
                    request.error
                )
                resolve(deletedCount)
            }
        })
    }

    /**
     * 获取缓存统计信息
     * @returns 统计信息
     */
    async getStats(): Promise<CacheStats> {
        await this.ensureInitialized()

        if (!this.db) {
            return {
                size: 0,
                totalHits: 0,
                estimatedMemory: "0 KB",
                hitRate: 0
            }
        }

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readonly"
            )
            const store = transaction.objectStore(this.storeName)
            const request = store.openCursor()

            let size = 0
            let totalHits = 0
            let totalSize = 0

            request.onsuccess = event => {
                const cursor = (event.target as IDBRequest).result
                if (cursor) {
                    const entry = cursor.value as CacheEntry
                    size++
                    totalHits += entry.hitCount
                    totalSize += entry.key.length + entry.translation.length
                    cursor.continue()
                } else {
                    resolve({
                        size,
                        totalHits,
                        estimatedMemory: `${(totalSize / 1024).toFixed(2)} KB`,
                        hitRate: size > 0 ? totalHits / size : 0
                    })
                }
            }

            request.onerror = () => {
                console.error("[L2Cache] Failed to get stats:", request.error)
                resolve({
                    size: 0,
                    totalHits: 0,
                    estimatedMemory: "0 KB",
                    hitRate: 0
                })
            }
        })
    }

    /**
     * 获取所有缓存条目
     * @returns 缓存条目数组
     */
    async getAllEntries(): Promise<CacheEntry[]> {
        await this.ensureInitialized()

        if (!this.db) {
            return []
        }

        return new Promise(resolve => {
            const transaction = this.db!.transaction(
                [this.storeName],
                "readonly"
            )
            const store = transaction.objectStore(this.storeName)
            const request = store.getAll()

            request.onsuccess = () => resolve(request.result as CacheEntry[])
            request.onerror = () => {
                console.error(
                    "[L2Cache] Failed to get all entries:",
                    request.error
                )
                resolve([])
            }
        })
    }

    /**
     * 关闭数据库连接
     */
    close(): void {
        if (this.db) {
            this.db.close()
            this.db = null
            this.initPromise = null
        }
    }
}
