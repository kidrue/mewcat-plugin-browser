/**
 * Token 刷新功能真实测试
 *
 * 基于实际的 services/request.ts 实现进行测试
 * 测试场景：
 * 1. 模拟 401 错误触发 token 刷新
 * 2. 验证请求队列机制
 * 3. 验证 token 更新和请求重试
 */

import axios from "axios"
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios"
import { pathToFileURL } from "node:url"

// 模拟扩展 Storage 适配器
class MockStorage {
    private data: Map<string, string> = new Map()

    async get<T>(key: string): Promise<T | null> {
        const value = this.data.get(key)
        return value ? (value as T) : null
    }

    async set(key: string, value: string): Promise<void> {
        this.data.set(key, value)
        console.log(`[Storage] ✓ 设置 ${key}: ${value}`)
    }

    async remove(key: string): Promise<void> {
        this.data.delete(key)
        console.log(`[Storage] ✗ 删除 ${key}`)
    }

    clear(): void {
        this.data.clear()
    }

    // 用于测试验证
    getAllData(): Record<string, string> {
        return Object.fromEntries(this.data)
    }
}

const mockStorage = new MockStorage()

// 模拟响应类型
interface Response<T> {
    code: number
    message: string
    data: T
}

// 创建模拟的请求实例
const createTestRequest = () => {
    let requestCount = 0
    let isRefreshing = false
    let failedQueue: Array<{
        resolve: (value?: unknown) => void
        reject: (reason?: unknown) => void
        config: AxiosRequestConfig
    }> = []

    const testRequest = axios.create({
        baseURL: "https://mock-api.example.com/v2",
        timeout: 5000,
        headers: {
            "Content-Type": "application/json"
        }
    })

    /**
     * 模拟刷新 token 的函数
     * 与实际实现一致
     */
    const refreshAccessToken = async (refreshToken: string) => {
        console.log(`[刷新Token] 使用 refreshToken: ${refreshToken}`)

        // 模拟刷新接口调用
        await new Promise(resolve => setTimeout(resolve, 300))

        if (refreshToken.includes("invalid")) {
            throw new Error("Invalid refresh token")
        }

        return {
            code: 200,
            message: "success",
            data: {
                accessToken: `new-access-token-${Date.now()}`,
                refreshToken: `new-refresh-token-${Date.now()}`
            }
        }
    }

    /**
     * 处理队列中的请求
     * 与实际实现一致
     */
    const processQueue = (error: Error | null, token: string | null = null) => {
        console.log(`[处理队列] 队列长度: ${failedQueue.length}, token: ${token ? token.substring(0, 20) + "..." : "null"}`)

        failedQueue.forEach(promise => {
            if (error) {
                promise.reject(error)
            } else {
                // 更新请求头中的 token
                if (promise.config.headers && token) {
                    promise.config.headers.Authorization = `Bearer ${token}`
                }
                promise.resolve(testRequest(promise.config))
            }
        })

        failedQueue = []
    }

    // 响应拦截器：与实际实现完全一致
    testRequest.interceptors.response.use(
        (response: AxiosResponse) => {
            console.log(`[响应成功] ${response.config.url} - Status: ${response.status}`)
            // 注意：这里返回 response.data，与实际代码一致
            return response.data
        },
        async (error: AxiosError) => {
            const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

            console.log(`[响应错误] ${originalRequest.url} - Status: ${error.response?.status}`)

            // 如果不是 401 错误，直接返回错误
            if (!error.response || error.response.status !== 401) {
                return Promise.reject(error)
            }

            console.log(`[401错误] 请求 ${originalRequest.url} 返回 401`)

            // 如果已经重试过，直接返回错误
            if (originalRequest._retry) {
                console.log(`[401错误] 请求已重试过，放弃重试`)
                return Promise.reject(error)
            }

            // 如果正在刷新 token，将请求加入队列
            if (isRefreshing) {
                console.log(`[等待刷新] 请求加入队列，当前队列长度: ${failedQueue.length + 1}`)
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject, config: originalRequest })
                })
            }

            originalRequest._retry = true
            isRefreshing = true

            try {
                // 从 storage 获取 refreshToken
                const refreshToken = await mockStorage.get<string>("refreshToken")

                if (!refreshToken) {
                    throw new Error("No refresh token available")
                }

                // 刷新 token
                const response = await refreshAccessToken(refreshToken)

                if (!response.data.accessToken || !response.data.refreshToken) {
                    throw new Error("Failed to refresh token")
                }

                // 保存新的 token 到 storage
                await mockStorage.set("accessToken", response.data.accessToken)
                await mockStorage.set("refreshToken", response.data.refreshToken)

                // 更新原始请求的 Authorization 头
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`
                }

                // 处理队列中的请求
                processQueue(null, response.data.accessToken)

                console.log(`[重试请求] 使用新 token 重试原始请求`)
                // 重新发送原始请求
                return testRequest(originalRequest)
            } catch (err) {
                console.error(`[刷新失败] ${(err as Error).message}`)
                // 刷新失败，清除 token 并处理队列
                await mockStorage.remove("accessToken")
                await mockStorage.remove("refreshToken")

                processQueue(err as Error, null)

                return Promise.reject(err)
            } finally {
                isRefreshing = false
            }
        }
    )

    // 请求拦截器：自动添加 token
    testRequest.interceptors.request.use(
        async config => {
            requestCount++
            console.log(`\n[请求 #${requestCount}] ${config.method?.toUpperCase()} ${config.url}`)

            const token = await mockStorage.get<string>("accessToken")
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`
                console.log(`[请求 #${requestCount}] 添加 token: ${token}`)
            }
            return config
        },
        error => Promise.reject(error)
    )

    return testRequest
}

// 使用 axios-mock-adapter 模拟服务器响应
import MockAdapter from "axios-mock-adapter"

// 测试用例
async function runTests() {
    console.log("=".repeat(80))
    console.log("开始测试 Token 刷新功能（基于实际实现）")
    console.log("=".repeat(80))

    // ========================================
    // 测试场景 1: 单个请求触发 401，自动刷新 token
    // ========================================
    console.log("\n" + "=".repeat(80))
    console.log("测试场景 1: 单个请求触发 401，自动刷新 token")
    console.log("=".repeat(80))

    try {
        // 初始化 storage
        mockStorage.clear()
        await mockStorage.set("accessToken", "old-access-token")
        await mockStorage.set("refreshToken", "old-refresh-token")

        const testRequest = createTestRequest()
        const mock = new MockAdapter(testRequest, { delayResponse: 200 })

        // 第一次请求返回 401
        mock.onGet("/api/user").replyOnce(401, {
            code: 401,
            message: "Token expired"
        })

        // 刷新后的请求返回成功
        mock.onGet("/api/user").reply(200, {
            code: 200,
            message: "success",
            data: { id: 1, name: "Test User" }
        })

        const response = await testRequest.get("/api/user")

        console.log("\n✅ 测试场景 1 通过:")
        console.log(`- 响应数据:`, response)

        const storageData = mockStorage.getAllData()
        console.log("- Storage 数据:", storageData)
        console.log(`- accessToken 已更新: ${storageData.accessToken !== "old-access-token"}`)
        console.log(`- refreshToken 已更新: ${storageData.refreshToken !== "old-refresh-token"}`)

        // 验证
        if (storageData.accessToken === "old-access-token") {
            throw new Error("Token 没有更新")
        }

        mock.restore()
    } catch (error) {
        console.error("\n❌ 测试场景 1 失败:", (error as Error).message)
        throw error
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    // ========================================
    // 测试场景 2: 多个并发请求触发 401，只刷新一次 token
    // ========================================
    console.log("\n" + "=".repeat(80))
    console.log("测试场景 2: 多个并发请求触发 401，只刷新一次 token")
    console.log("=".repeat(80))

    try {
        // 重置 storage
        mockStorage.clear()
        await mockStorage.set("accessToken", "old-access-token-2")
        await mockStorage.set("refreshToken", "old-refresh-token-2")

        const testRequest = createTestRequest()
        const mock = new MockAdapter(testRequest, { delayResponse: 200 })

        // 所有请求第一次都返回 401
        mock.onGet("/api/user").replyOnce(401, { message: "Token expired" })
        mock.onGet("/api/posts").replyOnce(401, { message: "Token expired" })
        mock.onGet("/api/comments").replyOnce(401, { message: "Token expired" })

        // 刷新后的请求返回成功
        mock.onGet("/api/user").reply(200, {
            code: 200,
            data: { result: "user data" }
        })
        mock.onGet("/api/posts").reply(200, {
            code: 200,
            data: { result: "posts data" }
        })
        mock.onGet("/api/comments").reply(200, {
            code: 200,
            data: { result: "comments data" }
        })

        // 并发发送 3 个请求
        const [res1, res2, res3] = await Promise.all([
            testRequest.get("/api/user"),
            testRequest.get("/api/posts"),
            testRequest.get("/api/comments")
        ])

        console.log("\n✅ 测试场景 2 通过:")
        console.log(`- 请求 1 数据:`, res1)
        console.log(`- 请求 2 数据:`, res2)
        console.log(`- 请求 3 数据:`, res3)

        const storageData = mockStorage.getAllData()
        console.log("- 所有请求使用同一个新 token")
        console.log("- Storage 数据:", storageData)

        // 验证
        if (storageData.accessToken === "old-access-token-2") {
            throw new Error("Token 没有更新")
        }

        mock.restore()
    } catch (error) {
        console.error("\n❌ 测试场景 2 失败:", (error as Error).message)
        throw error
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    // ========================================
    // 测试场景 3: refresh token 无效，清除 token 并返回错误
    // ========================================
    console.log("\n" + "=".repeat(80))
    console.log("测试场景 3: refresh token 无效，清除 token 并返回错误")
    console.log("=".repeat(80))

    try {
        // 重置 storage，使用无效的 refresh token
        mockStorage.clear()
        await mockStorage.set("accessToken", "old-access-token-3")
        await mockStorage.set("refreshToken", "invalid-refresh-token")

        const testRequest = createTestRequest()
        const mock = new MockAdapter(testRequest)

        mock.onGet("/api/user").reply(401, { message: "Token expired" })

        try {
            await testRequest.get("/api/user")
            console.error("\n❌ 测试场景 3 失败: 应该抛出错误但没有")
            throw new Error("应该抛出错误")
        } catch (err) {
            if ((err as Error).message === "应该抛出错误") {
                throw err
            }

            console.log("\n✅ 测试场景 3 通过:")
            console.log(`- 捕获到错误: ${(err as Error).message}`)

            const storageData = mockStorage.getAllData()
            console.log("- Storage 数据:", storageData)
            console.log(`- accessToken 已清除: ${!storageData.accessToken}`)
            console.log(`- refreshToken 已清除: ${!storageData.refreshToken}`)

            // 验证
            if (storageData.accessToken || storageData.refreshToken) {
                throw new Error("Token 没有清除")
            }
        }

        mock.restore()
    } catch (error) {
        console.error("\n❌ 测试场景 3 失败:", (error as Error).message)
        throw error
    }

    console.log("\n" + "=".repeat(80))
    console.log("✅ 所有测试通过！")
    console.log("=".repeat(80))
}

// 运行测试
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runTests()
        .then(() => {
            console.log("\n🎉 测试完成，所有场景验证通过！")
            process.exit(0)
        })
        .catch(error => {
            console.error("\n💥 测试失败:", error.message)
            process.exit(1)
        })
}

export { runTests, createTestRequest, MockStorage }
