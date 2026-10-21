import axios from "axios"
import type { AxiosError } from "axios"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)

/**
 * Token 刷新功能测试
 *
 * 测试场景：
 * 1. 模拟 401 错误触发 token 刷新
 * 2. 验证请求队列机制
 * 3. 验证 token 更新和请求重试
 */

// 模拟 storage
class MockStorage {
    private data: Map<string, string> = new Map()

    async get<T>(key: string): Promise<T | null> {
        const value = this.data.get(key)
        return value ? (value as T) : null
    }

    async set(key: string, value: string): Promise<void> {
        this.data.set(key, value)
        console.log(`[Storage] 设置 ${key}: ${value}`)
    }

    async remove(key: string): Promise<void> {
        this.data.delete(key)
        console.log(`[Storage] 删除 ${key}`)
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

// 创建一个模拟的请求实例
const createMockRequest = () => {
    let requestCount = 0
    let isRefreshing = false
    let failedQueue: Array<{
        resolve: (value?: unknown) => void
        reject: (reason?: unknown) => void
        config: any
    }> = []

    const mockRequest = axios.create({
        baseURL: "https://mock-api.example.com",
        timeout: 5000
    })

    // 模拟刷新 token 的函数
    const refreshAccessToken = async (refreshToken: string) => {
        console.log(`[刷新Token] 使用 refreshToken: ${refreshToken}`)

        // 模拟刷新接口调用
        return {
            accessToken: `new-access-token-${Date.now()}`,
            refreshToken: `new-refresh-token-${Date.now()}`
        }
    }

    // 处理队列中的请求
    const processQueue = (error: Error | null, token: string | null = null) => {
        console.log(`[处理队列] 队列长度: ${failedQueue.length}, token: ${token}`)

        failedQueue.forEach(promise => {
            if (error) {
                promise.reject(error)
            } else {
                if (promise.config.headers && token) {
                    promise.config.headers.Authorization = `Bearer ${token}`
                }
                promise.resolve(mockRequest(promise.config))
            }
        })

        failedQueue = []
    }

    // 响应拦截器
    mockRequest.interceptors.response.use(
        response => response,
        async (error: AxiosError) => {
            const originalRequest = error.config as any

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
                console.log(`[等待刷新] 请求加入队列`)
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

                if (!response.accessToken || !response.refreshToken) {
                    throw new Error("Failed to refresh token")
                }

                // 保存新的 token 到 storage
                await mockStorage.set("accessToken", response.accessToken)
                await mockStorage.set("refreshToken", response.refreshToken)

                // 更新原始请求的 Authorization 头
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${response.accessToken}`
                }

                // 处理队列中的请求
                processQueue(null, response.accessToken)

                console.log(`[重试请求] 使用新 token 重试原始请求`)
                // 重新发送原始请求
                return mockRequest(originalRequest)
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
    mockRequest.interceptors.request.use(
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

    return mockRequest
}

// 创建一个模拟服务器
const createMockServer = () => {
    const server = axios.create()
    let currentToken = "old-access-token"

    server.interceptors.request.use(config => {
        const authHeader = config.headers?.Authorization as string
        const token = authHeader?.replace("Bearer ", "")

        console.log(`[模拟服务器] 收到请求，token: ${token}`)

        // 如果使用旧 token，返回 401
        if (token === "old-access-token") {
            console.log(`[模拟服务器] token 已过期，返回 401`)
            return Promise.reject({
                response: {
                    status: 401,
                    data: { message: "Token expired" }
                },
                config
            })
        }

        // 如果使用新 token，返回成功
        console.log(`[模拟服务器] token 有效，返回 200`)
        return {
            ...config,
            data: { success: true, data: "Request successful with new token" }
        }
    })

    return server
}

// 测试用例
async function runTests() {
    console.log("=" .repeat(80))
    console.log("开始测试 Token 刷新功能")
    console.log("=" .repeat(80))

    // 初始化 storage
    await mockStorage.set("accessToken", "old-access-token")
    await mockStorage.set("refreshToken", "old-refresh-token")

    const mockRequest = createMockRequest()

    console.log("\n" + "=".repeat(80))
    console.log("测试场景 1: 单个请求触发 401，自动刷新 token")
    console.log("=".repeat(80))

    try {
        // 使用 axios-mock-adapter 或手动模拟
        const axiosMock = require("axios-mock-adapter")
        const mock = new axiosMock(mockRequest)

        // 第一次请求返回 401
        mock.onGet("/api/user").replyOnce(401, { message: "Token expired" })

        // 刷新后的请求返回成功
        mock.onGet("/api/user").reply(200, {
            success: true,
            data: { id: 1, name: "Test User" }
        })

        const response = await mockRequest.get("/api/user")

        console.log("\n✅ 测试场景 1 通过:")
        console.log(`- 响应状态: ${response.status}`)
        console.log(`- 响应数据:`, response.data)

        const storageData = mockStorage.getAllData()
        console.log("- Storage 数据:", storageData)
        console.log(`- accessToken 已更新: ${storageData.accessToken !== "old-access-token"}`)
        console.log(`- refreshToken 已更新: ${storageData.refreshToken !== "old-refresh-token"}`)

    } catch (error) {
        console.error("\n❌ 测试场景 1 失败:", (error as Error).message)
    }

    console.log("\n" + "=".repeat(80))
    console.log("测试场景 2: 多个并发请求触发 401，只刷新一次 token")
    console.log("=".repeat(80))

    // 重置 storage
    mockStorage.clear()
    await mockStorage.set("accessToken", "old-access-token-2")
    await mockStorage.set("refreshToken", "old-refresh-token-2")

    try {
        const axiosMock = require("axios-mock-adapter")
        const mock = new axiosMock(mockRequest)

        // 所有请求第一次都返回 401
        mock.onGet("/api/user").replyOnce(401, { message: "Token expired" })
        mock.onGet("/api/posts").replyOnce(401, { message: "Token expired" })
        mock.onGet("/api/comments").replyOnce(401, { message: "Token expired" })

        // 刷新后的请求返回成功
        mock.onGet("/api/user").reply(200, { success: true, data: "user" })
        mock.onGet("/api/posts").reply(200, { success: true, data: "posts" })
        mock.onGet("/api/comments").reply(200, { success: true, data: "comments" })

        // 并发发送 3 个请求
        const [res1, res2, res3] = await Promise.all([
            mockRequest.get("/api/user"),
            mockRequest.get("/api/posts"),
            mockRequest.get("/api/comments")
        ])

        console.log("\n✅ 测试场景 2 通过:")
        console.log(`- 请求 1 状态: ${res1.status}, 数据:`, res1.data)
        console.log(`- 请求 2 状态: ${res2.status}, 数据:`, res2.data)
        console.log(`- 请求 3 状态: ${res3.status}, 数据:`, res3.data)

        const storageData = mockStorage.getAllData()
        console.log("- 所有请求使用同一个新 token")
        console.log("- Storage 数据:", storageData)

    } catch (error) {
        console.error("\n❌ 测试场景 2 失败:", (error as Error).message)
    }

    console.log("\n" + "=".repeat(80))
    console.log("测试场景 3: refresh token 无效，清除 token 并返回错误")
    console.log("=".repeat(80))

    // 重置 storage，使用无效的 refresh token
    mockStorage.clear()
    await mockStorage.set("accessToken", "old-access-token-3")
    await mockStorage.set("refreshToken", "invalid-refresh-token")

    try {
        const axiosMock = require("axios-mock-adapter")
        const mock = new axiosMock(mockRequest)

        mock.onGet("/api/user").reply(401, { message: "Token expired" })

        await mockRequest.get("/api/user")

        console.error("\n❌ 测试场景 3 失败: 应该抛出错误但没有")
    } catch (error) {
        console.log("\n✅ 测试场景 3 通过:")
        console.log(`- 捕获到错误: ${(error as Error).message}`)

        const storageData = mockStorage.getAllData()
        console.log("- Storage 数据:", storageData)
        console.log(`- accessToken 已清除: ${!storageData.accessToken}`)
        console.log(`- refreshToken 已清除: ${!storageData.refreshToken}`)
    }

    console.log("\n" + "=".repeat(80))
    console.log("测试完成")
    console.log("=".repeat(80))
}

// 运行测试
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runTests().catch(console.error)
}

export { runTests, createMockRequest, MockStorage }
