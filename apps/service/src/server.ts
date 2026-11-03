import { AnalyticsStore } from "./analytics/store.js"
import { startAnalysisWorker } from "./analytics/worker.js"
import { buildApp } from "./app.js"
import { loadConfig } from "./config.js"
import { ensureDatabaseDirectory } from "./database-path.js"
import { loadKeys } from "./keys.js"
import { createStore } from "./store.js"

async function main() {
    const config = loadConfig()
    const keys = await loadKeys(config.KEYS_FILE)
    await ensureDatabaseDirectory(config.DATABASE_URL)
    const store = createStore(config.DATABASE_URL)
    const app = await buildApp({ config, store, keys })
    try {
        // 访问实际表，缺少迁移时不启动一个只能报错的服务。
        await store.db.client.count()
        await store.db.apiCall.count()
        await store.db.analysisJob.count()
        const analytics = new AnalyticsStore(store, config)
        const cleanupData = async () => {
            await analytics.cleanup()
            await store.cleanup(
                Date.now(),
                config.ANALYTICS_CALL_RETENTION_DAYS
            )
        }
        await cleanupData()
        const stopWorker = startAnalysisWorker(analytics, () =>
            app.log.error(
                { code: "ANALYSIS_WORKER_FAILED" },
                "analysis worker failed"
            )
        )
        const cleanup = setInterval(
            () => {
                void cleanupData().catch(() =>
                    app.log.error({ code: "CLEANUP_FAILED" }, "cleanup failed")
                )
            },
            60 * 60 * 1000
        )
        cleanup.unref()
        app.addHook("onClose", async () => {
            clearInterval(cleanup)
            await stopWorker()
            await store.db.$disconnect()
        })
        let closing = false
        const close = () => {
            if (!closing) {
                closing = true
                void app.close()
            }
        }
        process.once("SIGINT", close)
        process.once("SIGTERM", close)
        await app.listen({ host: config.HOST, port: config.PORT })
    } catch (error) {
        await app.close()
        await store.db.$disconnect()
        throw error
    }
}
main().catch((error: unknown) => {
    console.error(
        error instanceof Error && error.message.startsWith("配置错误")
            ? error.message
            : "启动失败：请检查环境变量、密钥文件、数据库迁移及端口。"
    )
    process.exitCode = 1
})
