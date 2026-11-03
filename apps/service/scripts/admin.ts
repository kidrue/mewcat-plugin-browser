import { randomBytes, randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { createIdentity, publicKeys } from "@mewcat/protocol"
import { calculateJwkThumbprint } from "jose"

import { AnalyticsStore } from "../src/analytics/store.js"
import { loadConfig } from "../src/config.js"
import { ensureDatabaseDirectory } from "../src/database-path.js"
import { serializeKeys } from "../src/keys.js"
import { createStore } from "../src/store.js"
import { runAnalyticsCli } from "./analytics.js"

async function main() {
    const [command, argument] = process.argv.slice(2)
    if (!command || command === "help") {
        console.log(
            "命令：keys | clients | revoke <clientId> | cleanup | analytics help"
        )
        return
    }
    if (command === "keys") {
        const path = resolve(
            process.env.KEYS_FILE ?? "./secrets/server-keys.json"
        )
        const identity = await createIdentity(true)
        const keyId = randomUUID()
        await mkdir(dirname(path), { recursive: true, mode: 0o700 })
        await writeFile(
            path,
            JSON.stringify(
                await serializeKeys(
                    identity,
                    keyId,
                    randomBytes(32).toString("base64url")
                ),
                null,
                2
            ) + "\n",
            { flag: "wx", mode: 0o600 }
        )
        const keys = await publicKeys(identity, keyId)
        console.log(
            `密钥已保存：${path}\n服务器签名公钥指纹：${await calculateJwkThumbprint(keys.signingKey)}`
        )
        return
    }
    if (!["clients", "revoke", "cleanup", "analytics"].includes(command))
        throw new Error("未知命令，请运行 npm run admin -- help")
    const databaseUrl = process.env.DATABASE_URL ?? "file:./data/mewcat.db"
    await ensureDatabaseDirectory(databaseUrl)
    const store = createStore(databaseUrl)
    try {
        switch (command) {
            case "analytics":
                await runAnalyticsCli(
                    process.argv.slice(3),
                    new AnalyticsStore(store, loadConfig())
                )
                break
            case "clients":
                console.table(
                    await store.db.client.findMany({
                        select: {
                            id: true,
                            name: true,
                            createdAt: true,
                            revokedAt: true
                        },
                        orderBy: { createdAt: "desc" },
                        take: 100
                    })
                )
                break
            case "revoke":
                if (!argument) throw new Error("缺少 clientId")
                await store.revokeClient(argument)
                console.log("客户端已撤销")
                break
            case "cleanup":
                {
                    const config = loadConfig()
                    console.log(
                        await new AnalyticsStore(store, config).cleanup()
                    )
                    console.log(
                        await store.cleanup(
                            Date.now(),
                            config.ANALYTICS_CALL_RETENTION_DAYS
                        )
                    )
                }
                break
        }
    } finally {
        await store.db.$disconnect()
    }
}
main().catch((error: unknown) => {
    const code = (error as { code?: string }).code
    console.error(
        code === "EEXIST"
            ? "密钥文件已存在，为避免破坏现有客户端连接，未覆盖。"
            : error instanceof Error && error.name === "Error"
              ? error.message
              : "操作失败，请检查配置、数据库迁移和客户端 ID。"
    )
    process.exitCode = 1
})
