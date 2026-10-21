import { randomUUID } from "node:crypto"
import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises"
import { z } from "zod"

const requiredKeys = [
    "SILICONFLOW_API_KEY",
    "SILICONFLOW_BASE_URL",
    "SILICONFLOW_MODEL",
    "ALLOWED_ORIGINS"
] as const
const smtpKeys = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "FEEDBACK_TO"
] as const
const allowedKeys = [...requiredKeys, ...smtpKeys]
const allowedKeySet = new Set<string>(allowedKeys)
const smtpKeySet = new Set<string>(smtpKeys)
const smtpSchema = z.object({
    SMTP_HOST: z
        .string()
        .min(1)
        .regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    SMTP_SECURE: z.enum(["true", "false"]),
    SMTP_USER: z.string().min(1),
    SMTP_PASS: z.string().min(1),
    SMTP_FROM: z.email(),
    FEEDBACK_TO: z.email()
})

function parseRuntimeConfig(text: string): Map<string, string> {
    const values = new Map<string, string>()
    for (const line of text.split(/\r?\n/)) {
        if (!line) continue
        const separator = line.indexOf("=")
        const key = separator < 0 ? line : line.slice(0, separator)
        const value = separator < 0 ? "" : line.slice(separator + 1)
        if (!allowedKeySet.has(key))
            throw new Error(`不允许的运行时配置：${key}`)
        if (!value) throw new Error(`运行时配置不能为空：${key}`)
        if (/[\r\n\0]/.test(value))
            throw new Error(`运行时配置包含非法字符：${key}`)
        if (values.has(key)) throw new Error(`运行时配置重复：${key}`)
        values.set(key, value)
    }
    for (const key of requiredKeys) {
        if (!values.has(key)) throw new Error(`缺少运行时配置：${key}`)
    }
    if (!/^sk-[A-Za-z0-9._-]+$/.test(values.get("SILICONFLOW_API_KEY")!)) {
        throw new Error("SILICONFLOW_API_KEY 格式无效")
    }
    const baseUrl = new URL(values.get("SILICONFLOW_BASE_URL")!)
    if (baseUrl.protocol !== "https:")
        throw new Error("SILICONFLOW_BASE_URL 必须使用 HTTPS")
    const origins = values.get("ALLOWED_ORIGINS")!.split(",")
    if (
        origins.some(origin => !/^chrome-extension:\/\/[a-p]{32}$/.test(origin))
    ) {
        throw new Error("ALLOWED_ORIGINS 格式无效")
    }
    if (smtpKeys.some(key => values.has(key))) {
        const result = smtpSchema.safeParse(
            Object.fromEntries(smtpKeys.map(key => [key, values.get(key)]))
        )
        if (!result.success) {
            throw new Error(
                `SMTP 配置不完整或格式无效：${result.error.issues.map(issue => issue.path.join(".")).join(", ")}`
            )
        }
    }
    return values
}

function mergeConfig(current: string, runtime: Map<string, string>): string {
    const updatedKeys = allowedKeys.filter(key => runtime.has(key))
    const retained = current
        .split(/\r?\n/)
        .filter(line => !updatedKeys.some(key => line.startsWith(`${key}=`)))
        .filter((line, index, lines) => line !== "" || index < lines.length - 1)
    return `${[
        ...retained,
        ...updatedKeys.map(key => {
            const value = runtime.get(key)!
            // 双引号转义保留反斜杠和引号，$$ 防止 Compose 展开密码中的变量。
            const serialized = smtpKeySet.has(key)
                ? JSON.stringify(value).replaceAll("$", () => "$$")
                : value
            return `${key}=${serialized}`
        })
    ].join("\n")}\n`
}

async function main() {
    const [envPath, runtimePath] = process.argv.slice(2)
    if (!envPath || !runtimePath)
        throw new Error("用法：update-runtime-env <envPath> <runtimePath>")
    const [current, incoming] = await Promise.all([
        readFile(envPath, "utf8"),
        readFile(runtimePath, "utf8")
    ])
    const runtime = parseRuntimeConfig(incoming)
    const merged = mergeConfig(current, runtime)
    const temporaryPath = `${envPath}.${randomUUID()}.tmp`
    try {
        await writeFile(temporaryPath, merged, {
            encoding: "utf8",
            flag: "wx",
            mode: 0o600
        })
        if (process.platform === "win32") {
            await writeFile(envPath, merged, { encoding: "utf8", mode: 0o600 })
            await rm(temporaryPath, { force: true })
        } else {
            await rename(temporaryPath, envPath)
            await chmod(envPath, 0o600)
        }
        if (smtpKeys.every(key => runtime.has(key))) {
            console.log("SMTP 配置已同步，凭据不输出")
        }
    } catch (error) {
        await rm(temporaryPath, { force: true })
        throw error
    }
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "更新运行时配置失败")
    process.exitCode = 1
})
