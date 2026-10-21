/**
 * 翻译缓存使用示例
 */

import {
    createDefaultCache,
    TranslationCacheFactory,
    type CacheKeyParams
} from "./index"

/**
 * 示例1: 使用默认配置创建缓存
 */
async function example1_BasicUsage() {
    console.log("=== Example 1: Basic Usage ===")

    // 创建默认缓存实例
    const cache = createDefaultCache()

    // 初始化缓存
    await cache.init()

    // 设置缓存
    const params: CacheKeyParams = {
        text: "Hello, world!",
        sourceLang: "en",
        targetLang: "zh-CN",
        modelId: "gpt-4",
        aiRole: "translator"
    }

    await cache.set(params, "你好，世界！")

    // 获取缓存
    const result = await cache.get(params)
    console.log("Translation:", result) // 输出: 你好，世界！

    // 获取统计信息
    const stats = await cache.getStats()
    console.log("Cache stats:", stats)

    // 清理缓存
    cache.destroy()
}

/**
 * 示例2: 使用预设配置
 */
async function example2_PresetConfigs() {
    console.log("=== Example 2: Preset Configs ===")

    // 性能优先配置
    const perfCache = TranslationCacheFactory.createFromPreset("performance")
    await perfCache.init()

    // 存储优先配置
    const storageCache = TranslationCacheFactory.createFromPreset("storage")
    await storageCache.init()

    // 最小配置（仅内存）
    const minimalCache = TranslationCacheFactory.createFromPreset("minimal")
    await minimalCache.init()

    console.log("All caches initialized")

    // 清理
    perfCache.destroy()
    storageCache.destroy()
    minimalCache.destroy()
}

/**
 * 示例3: 自定义配置
 */
async function example3_CustomConfig() {
    console.log("=== Example 3: Custom Config ===")

    const cache = TranslationCacheFactory.create({
        l1Config: {
            maxSize: 500,
            defaultTTL: 30 * 60 * 1000 // 30分钟
        },
        l2Config: {
            dbName: "my-translation-cache",
            storeName: "my-translations"
        },
        cleanupConfig: {
            enabled: true,
            interval: 15 * 60 * 1000, // 15分钟
            maxAge: 24 * 60 * 60 * 1000, // 1天
            maxSize: 5000
        },
        enableL2: true,
        defaultTTL: 24 * 60 * 60 * 1000 // 1天
    })

    await cache.init()
    console.log("Custom cache initialized")

    cache.destroy()
}

/**
 * 示例4: 批量操作
 */
async function example4_BatchOperations() {
    console.log("=== Example 4: Batch Operations ===")

    const cache = createDefaultCache()
    await cache.init()

    // 批量设置
    const entries = [
        {
            params: {
                text: "Hello",
                sourceLang: "en",
                targetLang: "zh-CN",
                modelId: "gpt-4"
            },
            translation: "你好"
        },
        {
            params: {
                text: "World",
                sourceLang: "en",
                targetLang: "zh-CN",
                modelId: "gpt-4"
            },
            translation: "世界"
        },
        {
            params: {
                text: "Goodbye",
                sourceLang: "en",
                targetLang: "zh-CN",
                modelId: "gpt-4"
            },
            translation: "再见"
        }
    ]

    await cache.batchSet(entries)
    console.log("Batch set completed")

    // 批量获取
    const paramsList = entries.map(e => e.params)
    const results = await cache.batchGet(paramsList)

    console.log("Batch get results:")
    results.forEach((translation, text) => {
        console.log(`  ${text} -> ${translation}`)
    })

    cache.destroy()
}

/**
 * 示例5: 动态文本处理
 */
async function example5_DynamicText() {
    console.log("=== Example 5: Dynamic Text ===")

    const cache = createDefaultCache()
    await cache.init()

    // 动态文本会被提取为模板
    const dynamicTexts = [
        "You have 3 messages",
        "You have 5 messages",
        "You have 10 messages"
    ]

    // 第一次翻译
    await cache.set(
        {
            text: dynamicTexts[0],
            sourceLang: "en",
            targetLang: "zh-CN",
            modelId: "gpt-4"
        },
        "您有 3 条消息"
    )

    // 由于使用了模板提取，这些文本会共享同一个缓存键
    for (const text of dynamicTexts) {
        const result = await cache.get({
            text,
            sourceLang: "en",
            targetLang: "zh-CN",
            modelId: "gpt-4"
        })
        console.log(`${text} -> ${result}`)
    }

    cache.destroy()
}

/**
 * 示例6: 缓存清理
 */
async function example6_CacheCleanup() {
    console.log("=== Example 6: Cache Cleanup ===")

    const cache = createDefaultCache()
    await cache.init()

    // 添加一些缓存
    for (let i = 0; i < 100; i++) {
        await cache.set(
            {
                text: `Text ${i}`,
                sourceLang: "en",
                targetLang: "zh-CN",
                modelId: "gpt-4"
            },
            `文本 ${i}`
        )
    }

    console.log("Added 100 cache entries")

    // 获取统计信息
    let stats = await cache.getStats()
    console.log("Before cleanup:", stats)

    // 手动清理（清理超过1小时的缓存）
    const result = await cache.cleanup({
        maxAge: 60 * 60 * 1000 // 1小时
    })

    console.log("Cleanup result:", result)

    // 再次获取统计信息
    stats = await cache.getStats()
    console.log("After cleanup:", stats)

    cache.destroy()
}

/**
 * 示例7: 缓存预热
 */
async function example7_CacheWarmup() {
    console.log("=== Example 7: Cache Warmup ===")

    const cache = createDefaultCache()
    await cache.init()

    // 常用短语列表
    const commonPhrases = [
        "Hello",
        "Goodbye",
        "Thank you",
        "Please",
        "Yes",
        "No",
        "Welcome",
        "Sorry"
    ]

    // 先添加一些翻译
    for (const phrase of commonPhrases) {
        await cache.set(
            {
                text: phrase,
                sourceLang: "en",
                targetLang: "zh-CN",
                modelId: "gpt-4"
            },
            `[Translation of ${phrase}]`
        )
    }

    // 清空 L1 缓存（模拟页面刷新）
    // 注意：这里只是演示，实际使用中不需要手动清空

    // 预热缓存（从 L2 加载到 L1）
    await cache.warmup(commonPhrases, {
        sourceLang: "en",
        targetLang: "zh-CN",
        modelId: "gpt-4"
    })

    console.log("Cache warmed up")

    cache.destroy()
}

/**
 * 示例8: 导出和导入缓存
 */
async function example8_ExportImport() {
    console.log("=== Example 8: Export and Import ===")

    // 创建第一个缓存实例
    const cache1 = createDefaultCache()
    await cache1.init()

    // 添加一些数据
    await cache1.set(
        {
            text: "Export test",
            sourceLang: "en",
            targetLang: "zh-CN",
            modelId: "gpt-4"
        },
        "导出测试"
    )

    // 导出缓存
    const exportedData = await cache1.exportCache()
    console.log("Exported data:", exportedData)

    cache1.destroy()

    // 创建第二个缓存实例
    const cache2 = TranslationCacheFactory.create({
        l2Config: {
            dbName: "imported-cache-db"
        },
        enableL2: true
    })
    await cache2.init()

    // 导入缓存
    await cache2.importCache(exportedData)
    console.log("Cache imported")

    // 验证导入
    const result = await cache2.get({
        text: "Export test",
        sourceLang: "en",
        targetLang: "zh-CN",
        modelId: "gpt-4"
    })
    console.log("Imported translation:", result)

    cache2.destroy()
}

/**
 * 示例9: 文本规范化
 */
async function example9_TextNormalization() {
    console.log("=== Example 9: Text Normalization ===")

    const cache = createDefaultCache()
    await cache.init()

    // 这些文本在规范化后是相同的
    const variations = [
        "Hello,  world!",
        "Hello, world!",
        "Hello,\nworld!",
        "Hello,\r\nworld!",
        "  Hello, world!  "
    ]

    // 设置第一个变体的翻译
    await cache.set(
        {
            text: variations[0],
            sourceLang: "en",
            targetLang: "zh-CN",
            modelId: "gpt-4"
        },
        "你好，世界！"
    )

    // 所有变体都能命中缓存
    for (const text of variations) {
        const result = await cache.get({
            text,
            sourceLang: "en",
            targetLang: "zh-CN",
            modelId: "gpt-4"
        })
        console.log(`"${text}" -> ${result}`)
    }

    cache.destroy()
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
    try {
        await example1_BasicUsage()
        console.log("\n")

        await example2_PresetConfigs()
        console.log("\n")

        await example3_CustomConfig()
        console.log("\n")

        await example4_BatchOperations()
        console.log("\n")

        await example5_DynamicText()
        console.log("\n")

        await example6_CacheCleanup()
        console.log("\n")

        await example7_CacheWarmup()
        console.log("\n")

        await example8_ExportImport()
        console.log("\n")

        await example9_TextNormalization()
        console.log("\n")

        console.log("All examples completed!")
    } catch (error) {
        console.error("Error running examples:", error)
    }
}

// 如果直接运行此文件，执行所有示例
if (typeof window === "undefined") {
    // Node.js 环境
    runAllExamples()
}

export {
    example1_BasicUsage,
    example2_PresetConfigs,
    example3_CustomConfig,
    example4_BatchOperations,
    example5_DynamicText,
    example6_CacheCleanup,
    example7_CacheWarmup,
    example8_ExportImport,
    example9_TextNormalization,
    runAllExamples
}
