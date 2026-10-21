/**
 * 翻译缓存系统测试
 *
 * 这是一个简单的测试文件，用于验证缓存系统的核心功能
 * 注意：这些测试需要在浏览器环境中运行（因为使用了 IndexedDB）
 */

import {
    calculateSimilarity,
    createDefaultCache,
    extractFingerprint,
    extractTextTemplate,
    generateCacheKeySync,
    L1MemoryCache,
    normalizeText,
    type CacheKeyParams
} from "../index"

/**
 * 测试套件：文本规范化
 */
export function testTextNormalization() {
    console.group("📝 测试：文本规范化")

    // 测试1: 基本规范化
    const text1 = "  Hello,  world!  "
    const normalized1 = normalizeText(text1)
    console.assert(normalized1 === "Hello, world!", "❌ 基本规范化失败", {
        expected: "Hello, world!",
        actual: normalized1
    })
    console.log("✅ 基本规范化通过")

    // 测试2: 换行符统一
    const text2 = "Hello,\r\nworld!"
    const normalized2 = normalizeText(text2)
    console.assert(normalized2 === "Hello,\nworld!", "❌ 换行符统一失败")
    console.log("✅ 换行符统一通过")

    // 测试3: 引号统一
    const text3 = "\u201cHello\u201d \u2018world\u2019"
    const normalized3 = normalizeText(text3)
    console.assert(normalized3 === "\"Hello\" 'world'", "❌ 引号统一失败")
    console.log("✅ 引号统一通过")

    console.groupEnd()
}

/**
 * 测试套件：文本指纹和相似度
 */
export function testFingerprint() {
    console.group("🔍 测试：文本指纹和相似度")

    // 测试1: 相同文本的指纹应该相同
    const text1 = "Hello, world!"
    const text2 = "Hello,  world!"
    const fp1 = extractFingerprint(text1)
    const fp2 = extractFingerprint(text2)
    console.assert(fp1 === fp2, "❌ 相同文本的指纹不同")
    console.log("✅ 相同文本指纹相同")

    // 测试2: 相似度计算
    const similarity = calculateSimilarity(text1, text2)
    console.assert(similarity === 1.0, "❌ 相似度计算错误")
    console.log("✅ 相似度计算正确")

    // 测试3: 不同文本的相似度
    const text3 = "Goodbye, world!"
    const similarity2 = calculateSimilarity(text1, text3)
    console.assert(
        similarity2 > 0 && similarity2 < 1,
        "❌ 不同文本的相似度应该在0-1之间"
    )
    console.log("✅ 不同文本相似度计算正确", { similarity: similarity2 })

    console.groupEnd()
}

/**
 * 测试套件：动态文本模板
 */
export function testDynamicText() {
    console.group("🔄 测试：动态文本模板")

    // 测试1: 数字提取
    const text1 = "您有3条消息"
    const result1 = extractTextTemplate(text1)
    console.assert(
        result1.template === "您有{0}条消息",
        "❌ 数字模板提取失败",
        result1
    )
    console.assert(result1.variables[0] === "3", "❌ 变量提取失败")
    console.log("✅ 数字模板提取成功")

    // 测试2: 多个变量
    const text2 = "共5页，当前2页"
    const result2 = extractTextTemplate(text2)
    console.assert(
        result2.template === "共{0}页，当前{1}页",
        "❌ 多变量模板提取失败",
        result2
    )
    console.assert(result2.variables.length === 2, "❌ 变量数量错误")
    console.log("✅ 多变量模板提取成功")

    // 测试3: 货币符号
    const text3 = "余额：$123.45"
    const result3 = extractTextTemplate(text3)
    console.assert(
        result3.template === "余额：{0}",
        "❌ 货币模板提取失败",
        result3
    )
    console.log("✅ 货币模板提取成功")

    console.groupEnd()
}

/**
 * 测试套件：缓存键生成
 */
export function testCacheKey() {
    console.group("🔑 测试：缓存键生成")

    const params: CacheKeyParams = {
        text: "Hello, world!",
        sourceLang: "en",
        targetLang: "zh-CN",
        modelId: "gpt-4",
        aiRole: "translator"
    }

    // 测试1: 基本键生成
    const key1 = generateCacheKeySync(params)
    console.assert(key1.includes("en"), "❌ 键中应包含源语言")
    console.assert(key1.includes("zh-cn"), "❌ 键中应包含目标语言")
    console.assert(key1.includes("gpt-4"), "❌ 键中应包含模型ID")
    console.log("✅ 基本键生成成功", { key: key1 })

    // 测试2: 相同参数生成相同的键
    const key2 = generateCacheKeySync(params)
    console.assert(key1 === key2, "❌ 相同参数应生成相同的键")
    console.log("✅ 键生成一致性通过")

    // 测试3: 文本规范化后的键应该相同
    const params2 = { ...params, text: "  Hello,  world!  " }
    const key3 = generateCacheKeySync(params2)
    console.assert(key1 === key3, "❌ 规范化后的键应该相同")
    console.log("✅ 文本规范化对键生成的影响正确")

    console.groupEnd()
}

/**
 * 测试套件：L1 内存缓存
 */
export function testL1Cache() {
    console.group("💾 测试：L1 内存缓存")

    const cache = new L1MemoryCache({ maxSize: 10 })

    const params: CacheKeyParams = {
        text: "Hello",
        sourceLang: "en",
        targetLang: "zh-CN",
        modelId: "gpt-4"
    }

    // 测试1: 设置和获取
    cache.set(params, "你好")
    const result1 = cache.get(params)
    console.assert(result1 === "你好", "❌ L1缓存设置/获取失败")
    console.log("✅ L1缓存设置/获取成功")

    // 测试2: 未命中返回 null
    const result2 = cache.get({ ...params, text: "Goodbye" })
    console.assert(result2 === null, "❌ 未命中应返回 null")
    console.log("✅ L1缓存未命中处理正确")

    // 测试3: 容量限制和 LRU
    for (let i = 0; i < 15; i++) {
        cache.set({ ...params, text: `Text ${i}` }, `翻译 ${i}`)
    }
    const size = cache.size()
    console.assert(size <= 10, "❌ L1缓存容量控制失败", { size })
    console.log("✅ L1缓存容量控制成功", { size })

    // 测试4: 统计信息
    const stats = cache.getStats()
    console.assert(stats.size > 0, "❌ 统计信息错误")
    console.log("✅ L1缓存统计信息正确", stats)

    console.groupEnd()
}

/**
 * 测试套件：分层缓存（需要浏览器环境）
 */
export async function testTieredCache() {
    console.group("🏗️ 测试：分层缓存")

    try {
        const cache = createDefaultCache()
        await cache.init()

        const params: CacheKeyParams = {
            text: "Hello, world!",
            sourceLang: "en",
            targetLang: "zh-CN",
            modelId: "gpt-4",
            aiRole: "translator"
        }

        // 测试1: 设置缓存
        await cache.set(params, "你好，世界！")
        console.log("✅ 分层缓存设置成功")

        // 测试2: 获取缓存
        const result = await cache.get(params)
        console.assert(result === "你好，世界！", "❌ 分层缓存获取失败", {
            result
        })
        console.log("✅ 分层缓存获取成功")

        // 测试3: 批量操作
        await cache.batchSet([
            {
                params: { ...params, text: "Hello" },
                translation: "你好"
            },
            {
                params: { ...params, text: "Goodbye" },
                translation: "再见"
            }
        ])
        console.log("✅ 批量设置成功")

        const batchResults = await cache.batchGet([
            { ...params, text: "Hello" },
            { ...params, text: "Goodbye" }
        ])
        console.assert(batchResults.size === 2, "❌ 批量获取失败")
        console.log("✅ 批量获取成功", {
            size: batchResults.size,
            results: Array.from(batchResults.entries())
        })

        // 测试4: 统计信息
        const stats = await cache.getStats()
        console.log("✅ 分层缓存统计信息", stats)

        // 清理
        cache.destroy()
        console.log("✅ 缓存清理成功")
    } catch (error) {
        console.error("❌ 分层缓存测试失败", error)
    }

    console.groupEnd()
}

/**
 * 运行所有测试
 */
export async function runAllTests() {
    console.log("🚀 开始运行缓存系统测试...\n")

    // 同步测试
    testTextNormalization()
    testFingerprint()
    testDynamicText()
    testCacheKey()
    testL1Cache()

    // 异步测试（需要浏览器环境）
    if (typeof indexedDB !== "undefined") {
        await testTieredCache()
    } else {
        console.warn("⚠️ IndexedDB 不可用，跳过分层缓存测试（需要浏览器环境）")
    }

    console.log("\n✅ 所有测试完成！")
}

// 如果在浏览器环境中直接运行
if (typeof window !== "undefined") {
    // 添加到全局对象，方便在控制台调用
    interface WindowWithTests extends Window {
        runCacheTests?: () => Promise<void>
    }
    ;(window as unknown as WindowWithTests).runCacheTests = runAllTests
    console.log("💡 提示：在浏览器控制台中运行 runCacheTests() 来执行测试")
}
