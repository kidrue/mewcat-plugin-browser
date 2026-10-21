/**
 * 环境检测工具
 * 用于判断当前运行环境，防止敏感信息在生产环境中泄露
 */

/**
 * 环境类型枚举
 */
export enum Environment {
    /** 开发环境 */
    DEVELOPMENT = "development",
    /** 测试环境 */
    TEST = "test",
    /** 生产环境 */
    PRODUCTION = "production"
}

/**
 * 检测当前环境类型
 * 基于多种环境变量和特征进行判断
 */
export function getCurrentEnvironment(): Environment {
    // 检查 Vite 环境变量
    const viteEnv = import.meta.env
    const viteMode = viteEnv?.MODE?.toLowerCase()
    if (viteMode === "production") {
        return Environment.PRODUCTION
    }
    if (viteMode === "development") {
        return Environment.DEVELOPMENT
    }
    if (viteMode === "test") {
        return Environment.TEST
    }
    if (viteEnv?.PROD) {
        return Environment.PRODUCTION
    }
    if (viteEnv?.DEV) {
        return Environment.DEVELOPMENT
    }

    // 检查浏览器环境特征
    if (typeof window !== "undefined") {
        // 检查扩展环境
        const isExtension =
            typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id

        if (isExtension) {
            // 检查扩展ID或其他生产环境标志
            const extensionId = chrome.runtime.id

            // 如果是发布的扩展ID（通常是固定的），则认为是生产环境
            // 开发环境的扩展ID通常包含特定模式或是临时的
            if (
                extensionId &&
                !extensionId.includes("unpacked") &&
                extensionId.length > 20
            ) {
                return Environment.PRODUCTION
            }
        }

        // 检查域名特征
        const hostname = window.location?.hostname
        if (hostname) {
            // 本地开发环境
            if (
                hostname === "localhost" ||
                hostname === "127.0.0.1" ||
                hostname.endsWith(".local")
            ) {
                return Environment.DEVELOPMENT
            }

            // 测试域名
            if (
                hostname.includes("test") ||
                hostname.includes("staging") ||
                hostname.includes("dev")
            ) {
                return Environment.TEST
            }
        }

        // 检查调试标志
        const isDebugMode =
            localStorage?.getItem("debug") === "true" ||
            sessionStorage?.getItem("debug") === "true" ||
            window.location?.search?.includes("debug=true")

        if (isDebugMode) {
            return Environment.DEVELOPMENT
        }
    }

    // 默认情况：如果无法确定，保守地认为是生产环境
    return Environment.PRODUCTION
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment(): boolean {
    return getCurrentEnvironment() === Environment.DEVELOPMENT
}

/**
 * 检查是否为测试环境
 */
export function isTest(): boolean {
    return getCurrentEnvironment() === Environment.TEST
}

/**
 * 检查是否为生产环境
 */
export function isProduction(): boolean {
    return getCurrentEnvironment() === Environment.PRODUCTION
}

/**
 * 检查是否为非生产环境（开发或测试）
 */
export function isNonProduction(): boolean {
    return !isProduction()
}

/**
 * 获取环境相关的配置
 * 用于根据环境返回不同的配置值
 */
export function getEnvironmentConfig<T>(config: {
    development?: T
    test?: T
    production: T
}): T {
    const env = getCurrentEnvironment()

    switch (env) {
        case Environment.DEVELOPMENT:
            return config.development ?? config.production
        case Environment.TEST:
            return config.test ?? config.production
        case Environment.PRODUCTION:
        default:
            return config.production
    }
}

/**
 * 安全地处理敏感数据
 * 在生产环境中移除敏感信息，在开发环境中保留
 */
export function secureSensitiveData<T>(
    data: T,
    sensitiveKeys: string[] = [],
    placeholder: string = ""
): T {
    if (isNonProduction()) {
        // 非生产环境，返回原数据
        return data
    }

    // 生产环境，清理敏感数据
    if (typeof data === "object" && data !== null) {
        const cleanData = { ...data } as Record<string, unknown>

        sensitiveKeys.forEach(key => {
            if (key in cleanData) {
                cleanData[key] = placeholder
            }
        })

        return cleanData as T
    }

    return data
}

/**
 * 条件性控制台输出
 * 只在非生产环境中输出调试信息
 */
export const devConsole = {
    log: (...args: unknown[]) => {
        if (isNonProduction()) {
            console.log(...args)
        }
    },
    warn: (...args: unknown[]) => {
        if (isNonProduction()) {
            console.warn(...args)
        }
    },
    error: (...args: unknown[]) => {
        if (isNonProduction()) {
            console.error(...args)
        }
    },
    info: (...args: unknown[]) => {
        if (isNonProduction()) {
            console.info(...args)
        }
    },
    debug: (...args: unknown[]) => {
        if (isDevelopment()) {
            console.debug(...args)
        }
    }
}

/**
 * 输出当前环境信息（仅在非生产环境）
 */
export function logEnvironmentInfo(): void {
    if (isNonProduction()) {
        const env = getCurrentEnvironment()
        console.log(`🌍 Current Environment: ${env}`)

        if (typeof window !== "undefined") {
            console.log(`🌐 Hostname: ${window.location?.hostname || "N/A"}`)
        }

        if (typeof chrome !== "undefined" && chrome.runtime) {
            console.log(`🔌 Extension ID: ${chrome.runtime.id}`)
        }
    }
}
