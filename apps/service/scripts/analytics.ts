import { open } from "node:fs/promises"
import { parseArgs } from "node:util"

import { retryJobs } from "../src/analytics/jobs.js"
import {
    AnalyticsQuery,
    parseRange,
    stringifyAnalytics,
    type CallFilter
} from "../src/analytics/query.js"
import type { AnalyticsStore } from "../src/analytics/store.js"
import { runAnalysisBatch } from "../src/analytics/worker.js"

export async function runAnalyticsCli(
    args: string[],
    analytics: AnalyticsStore,
    write: (text: string) => void | Promise<void> = text =>
        new Promise<void>((resolve, reject) => {
            process.stdout.write(text, error =>
                error ? reject(error) : resolve()
            )
        })
) {
    const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
            from: { type: "string" },
            to: { type: "string" },
            client: { type: "string" },
            route: { type: "string" },
            outcome: { type: "string" },
            cursor: { type: "string" },
            limit: { type: "string" },
            output: { type: "string" },
            "include-content": { type: "boolean", default: false }
        }
    })
    const [command = "help", argument, extra] = positionals
    const allowedOptions: Record<string, readonly string[]> = {
        help: [],
        summary: ["from", "to", "client"],
        profile: [],
        calls: ["from", "to", "client", "route", "outcome", "cursor", "limit"],
        export: [
            "from",
            "to",
            "client",
            "route",
            "outcome",
            "cursor",
            "limit",
            "output",
            "include-content"
        ],
        analyze: ["limit"],
        retry: [],
        purge: []
    }
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === false) continue
        if (!allowedOptions[command]?.includes(key))
            throw new Error(`命令 ${command} 不支持参数 --${key}`)
    }
    if (command === "help") {
        await write(
            "命令：analytics summary | profile <clientId> | calls | export | analyze | retry [clientId] | purge <clientId>\n参数：--from YYYY-MM-DD --to YYYY-MM-DD（UTC 半开区间） --client ID --route PATH --outcome success|failed|rejected --cursor TOKEN --limit 1–1000 --output FILE --include-content\n"
        )
        return
    }
    if (
        ![
            "summary",
            "profile",
            "calls",
            "export",
            "analyze",
            "retry",
            "purge"
        ].includes(command) ||
        extra
    )
        throw new Error("无效画像命令")
    if (
        (["profile", "purge"].includes(command) && !argument) ||
        (argument && !["profile", "retry", "purge"].includes(command))
    )
        throw new Error("设备 ID 参数不正确")
    const limitText = values.limit ?? (command === "analyze" ? "1" : "100")
    if (
        !/^\d+$/.test(limitText) ||
        Number(limitText) < 1 ||
        Number(limitText) > 1000
    )
        throw new Error("limit 必须为 1–1000 的整数")
    if (
        values.outcome &&
        !["success", "failed", "rejected"].includes(values.outcome)
    )
        throw new Error("无效 outcome")
    if ((values.output || values["include-content"]) && command !== "export")
        throw new Error("仅 export 支持输出文件和内容导出")
    if (values["include-content"] && (!values.output || !analytics.cipher))
        throw new Error("内容导出需要 --output 且启用内容密钥")
    const range = parseRange(values.from, values.to)
    const query = new AnalyticsQuery(analytics)
    const filters: CallFilter = {
        ...range,
        limit: Number(limitText),
        ...(values.client ? { clientId: values.client } : {}),
        ...(values.route ? { route: values.route } : {}),
        ...(values.outcome
            ? { outcome: values.outcome as "success" | "failed" | "rejected" }
            : {}),
        ...(values.cursor ? { cursor: values.cursor } : {})
    }
    let result: unknown
    switch (command) {
        case "summary":
            result = await query.summary(range, Date.now(), values.client)
            break
        case "profile":
            result = await query.profile(argument!)
            break
        case "calls":
            result = await query.calls(filters)
            break
        case "retry":
            result = await retryJobs(analytics, argument)
            break
        case "purge":
            result = await analytics.purge(argument!)
            break
        case "analyze":
            if (!analytics.cipher)
                throw new Error("分析需要开启内容采集并配置密钥")
            result = await runAnalysisBatch(analytics, undefined, {
                limit: Number(limitText)
            })
            break
        case "export": {
            // 先校验筛选和游标，避免错误参数创建空文件。
            let page = await query.calls(filters)
            const file = values.output
                ? await open(values.output, "wx", 0o600)
                : null
            try {
                for (;;) {
                    for (const item of page.items) {
                        const row = values["include-content"]
                            ? {
                                  ...item,
                                  content: item.translationRequestId
                                      ? await analytics.readContent(
                                            item.translationRequestId
                                        )
                                      : null
                              }
                            : item
                        const line = stringifyAnalytics(row) + "\n"
                        if (file) await file.writeFile(line)
                        else await write(line)
                    }
                    if (!page.nextCursor) break
                    page = await query.calls({
                        ...filters,
                        cursor: page.nextCursor
                    })
                }
            } finally {
                await file?.close()
            }
            return
        }
    }
    await write(stringifyAnalytics(result) + "\n")
}
