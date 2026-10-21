import { z } from "zod"

import repositoryOrigins from "../config/allowed-origins.json" with { type: "json" }

export const defaultAllowedOrigins = z
    .array(z.string().regex(/^chrome-extension:\/\/[a-p]{32}$/))
    .min(1)
    .parse(repositoryOrigins)
    .join(",")

const positive = (fallback: number, max = 2_000_000_000) =>
    z.coerce.number().int().positive().max(max).default(fallback)
const schema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: positive(3000, 65535),
    DATABASE_URL: z
        .string()
        .startsWith("file:")
        .default("file:./data/mewcat.db"),
    KEYS_FILE: z.string().default("./secrets/server-keys.json"),
    SILICONFLOW_API_KEY: z.string().min(1),
    SILICONFLOW_MODEL: z.string().min(1).max(200),
    SILICONFLOW_BASE_URL: z
        .url()
        .default("https://api.siliconflow.cn/v1")
        .refine(value => new URL(value).protocol === "https:"),
    UPSTREAM_TIMEOUT_MS: positive(30_000, 120_000),
    MAX_OUTPUT_TOKENS: positive(4096, 8192),
    MAX_CONCURRENT_REQUESTS: positive(8, 100),
    CLOCK_SKEW_MS: positive(300_000, 300_000),
    CLIENT_REQUESTS_PER_MINUTE: positive(20),
    IP_REQUESTS_PER_MINUTE: positive(60),
    CLIENT_DAILY_CHARACTERS: positive(20_000),
    IP_DAILY_CHARACTERS: positive(100_000),
    GLOBAL_DAILY_CHARACTERS: positive(1_000_000),
    GLOBAL_DAILY_REQUESTS: positive(10_000),
    REGISTRATIONS_PER_IP_PER_DAY: positive(10),
    INGRESS_REQUESTS_PER_MINUTE: positive(120),
    ALLOWED_ORIGINS: z
        .string()
        .transform(value => value || defaultAllowedOrigins)
        .default(defaultAllowedOrigins),
    TRUST_PROXY: z.string().default(""),
    LOG_LEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "silent"])
        .default("info"),
    SMTP_HOST: z.string().trim().default(""),
    SMTP_PORT: positive(587, 65535),
    SMTP_SECURE: z
        .enum(["true", "false"])
        .default("false")
        .transform(value => value === "true"),
    SMTP_USER: z.string().trim().default(""),
    SMTP_PASS: z.string().default(""),
    SMTP_FROM: z.union([z.email(), z.literal("")]).default(""),
    FEEDBACK_TO: z.email().default("kidrue.me@gmail.com"),
    FEEDBACK_CLIENT_REQUESTS_PER_HOUR: positive(3),
    FEEDBACK_IP_REQUESTS_PER_HOUR: positive(10),
    FEEDBACK_GLOBAL_REQUESTS_PER_DAY: positive(200)
})
export type Config = z.infer<typeof schema>
export function loadConfig(
    environment: Record<string, string | undefined> = process.env
): Config {
    const result = schema.safeParse(environment)
    if (!result.success)
        throw new Error(
            `配置错误：${result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
        )
    if (/^(true|\*|\d+)$/i.test(result.data.TRUST_PROXY.trim()))
        throw new Error(
            "TRUST_PROXY 必须为明确的代理 IP/CIDR 列表，不能信任任意代理"
        )
    return result.data
}
