import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const directories: string[] = []

async function fixture(current: string, incoming: string) {
    const directory = await mkdtemp(join(tmpdir(), "mewcat-runtime-config-"))
    directories.push(directory)
    const envPath = join(directory, ".env")
    const runtimePath = join(directory, "runtime.env")
    await writeFile(envPath, current, "utf8")
    await writeFile(runtimePath, incoming, "utf8")
    return { envPath, runtimePath }
}

function runUpdater(envPath: string, runtimePath: string) {
    return spawnSync(
        process.execPath,
        [
            "--import",
            "tsx",
            "scripts/update-runtime-env.ts",
            envPath,
            runtimePath
        ],
        { cwd: new URL("..", import.meta.url), encoding: "utf8" }
    )
}

afterEach(async () => {
    await Promise.all(
        directories
            .splice(0)
            .map(directory => rm(directory, { force: true, recursive: true }))
    )
})

describe("生产运行时配置更新", () => {
    it("管理员白名单保留、更新和显式清空，拒绝非法值", async () => {
        const required =
            "SILICONFLOW_API_KEY=sk-test\nSILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1\nSILICONFLOW_MODEL=test\nALLOWED_ORIGINS=chrome-extension://nnmceoehnacdjdpeeocdopnaejcnaibm\n"
        const id = "8f7ce4a1-1111-4321-8011-111111111111"
        for (const incoming of [
            "",
            `ANALYTICS_ADMIN_CLIENT_IDS= ${id},${id} \n`,
            "ANALYTICS_ADMIN_CLIENT_IDS=\n"
        ]) {
            const { envPath, runtimePath } = await fixture(
                `ANALYTICS_ADMIN_CLIENT_IDS=${id}\nKEEP=true\n`,
                required + incoming
            )
            expect(runUpdater(envPath, runtimePath).status).toBe(0)
            expect(await readFile(envPath, "utf8")).toContain(
                `ANALYTICS_ADMIN_CLIENT_IDS=${incoming === "ANALYTICS_ADMIN_CLIENT_IDS=\n" ? "" : id}\n`
            )
            expect(await readFile(envPath, "utf8")).toContain("KEEP=true")
        }
        for (const value of [
            "not-an-id",
            Array.from({ length: 21 }, () => crypto.randomUUID()).join(",")
        ]) {
            const { envPath, runtimePath } = await fixture(
                "KEEP=true\n",
                required + `ANALYTICS_ADMIN_CLIENT_IDS=${value}\n`
            )
            expect(runUpdater(envPath, runtimePath).status).not.toBe(0)
            expect(await readFile(envPath, "utf8")).toBe("KEEP=true\n")
        }
    })
    const translationConfig =
        "SILICONFLOW_API_KEY=sk-new-key\nSILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1\nSILICONFLOW_MODEL=deepseek-ai/DeepSeek-V4-Flash\nALLOWED_ORIGINS=chrome-extension://nnmceoehnacdjdpeeocdopnaejcnaibm\n"
    const smtpConfig =
        "SMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nSMTP_SECURE=false\nSMTP_USER=sender@example.com\nSMTP_PASS=test#password$literal\nSMTP_FROM=sender@example.com\nFEEDBACK_TO=receiver@example.com\n"
    const quotaConfig =
        "CLIENT_DAILY_CHARACTERS=500000\nIP_DAILY_CHARACTERS=500000\nGLOBAL_DAILY_CHARACTERS=0\nGLOBAL_DAILY_REQUESTS=0\n"

    it("仅同步明确可信代理地址，保留其他配置", async () => {
        const { envPath, runtimePath } = await fixture(
            "TRUST_PROXY=\n",
            translationConfig + "TRUST_PROXY=172.19.0.1/32\n"
        )
        expect(runUpdater(envPath, runtimePath).status).toBe(0)
        expect(await readFile(envPath, "utf8")).toContain(
            "TRUST_PROXY=172.19.0.1/32\n"
        )
    })
    it.each([
        "true",
        "*",
        "0.0.0.0/0",
        "::/0",
        "::/1",
        "::ffff:0.0.0.0/96",
        "not-an-ip"
    ])("拒绝不安全或无效的可信代理：%s", async proxy => {
        const { envPath, runtimePath } = await fixture(
            "TRUST_PROXY=\n",
            translationConfig + `TRUST_PROXY=${proxy}\n`
        )
        expect(runUpdater(envPath, runtimePath).status).not.toBe(0)
        expect(await readFile(envPath, "utf8")).toBe("TRUST_PROXY=\n")
    })

    it("发布同步50万设备/IP额度和全站不限额，覆盖旧值并保留密钥", async () => {
        const { envPath, runtimePath } = await fixture(
            "CLIENT_DAILY_CHARACTERS=20000\nIP_DAILY_CHARACTERS=100000\nGLOBAL_DAILY_CHARACTERS=1000000\nGLOBAL_DAILY_REQUESTS=10000\nANALYTICS_CONTENT_KEY=keep-this-key\n",
            translationConfig + quotaConfig
        )
        expect(runUpdater(envPath, runtimePath).status).toBe(0)
        const updated = await readFile(envPath, "utf8")
        expect(updated).toContain(quotaConfig)
        expect(updated).toContain("ANALYTICS_CONTENT_KEY=keep-this-key\n")
        expect(updated).not.toContain("CLIENT_DAILY_CHARACTERS=20000\n")
    })
    it.each([
        quotaConfig.replace(
            "CLIENT_DAILY_CHARACTERS=500000",
            "CLIENT_DAILY_CHARACTERS=0"
        ),
        quotaConfig.replace(
            "IP_DAILY_CHARACTERS=500000",
            "IP_DAILY_CHARACTERS=-1"
        ),
        quotaConfig.replace(
            "GLOBAL_DAILY_CHARACTERS=0",
            "GLOBAL_DAILY_CHARACTERS=-1"
        ),
        quotaConfig.replace(
            "GLOBAL_DAILY_REQUESTS=0",
            "GLOBAL_DAILY_REQUESTS=1.5"
        ),
        quotaConfig.replace("GLOBAL_DAILY_REQUESTS=0\n", "")
    ])("拒绝非法或不完整额度组合且不改写生产配置：%#", async incoming => {
        const { envPath, runtimePath } = await fixture(
            "CLIENT_DAILY_CHARACTERS=20000\n",
            translationConfig + incoming
        )
        expect(runUpdater(envPath, runtimePath).status).not.toBe(0)
        expect(await readFile(envPath, "utf8")).toBe(
            "CLIENT_DAILY_CHARACTERS=20000\n"
        )
    })

    it("同步完整 SMTP 配置，保留密码字面值且不向日志输出凭据", async () => {
        const { envPath, runtimePath } = await fixture(
            "DATABASE_URL=file:/app/data/mewcat.db\nSMTP_PASS=old-password\nSMTP_FROM=old@example.com\n",
            translationConfig + smtpConfig
        )
        const result = runUpdater(envPath, runtimePath)

        expect(result.status).toBe(0)
        expect(result.stdout + result.stderr).not.toContain(
            "test#password$literal"
        )
        const updated = await readFile(envPath, "utf8")
        expect(updated).toContain("DATABASE_URL=file:/app/data/mewcat.db\n")
        expect(updated).toContain('SMTP_PASS="test#password$$literal"\n')
        expect(updated).toContain('FEEDBACK_TO="receiver@example.com"\n')
        expect(updated).not.toContain("old-password")
    })

    it("为 Compose 转义密码中的引号、变量标记和尾反斜杠", async () => {
        const password = "quoted'\"${VALUE}\\"
        const { envPath, runtimePath } = await fixture(
            "",
            translationConfig +
                smtpConfig.replace("test#password$literal", () => password)
        )

        expect(runUpdater(envPath, runtimePath).status).toBe(0)
        expect(await readFile(envPath, "utf8")).toContain(
            'SMTP_PASS="quoted\'\\"$${VALUE}\\\\"\n'
        )
    })

    const composeAvailable =
        spawnSync("docker", ["compose", "version"], { encoding: "utf8" })
            .status === 0
    it
        .skipIf(!composeAvailable)
        .each([
            "test#password$literal",
            "literal$$pair",
            "quoted'\"${VALUE}\\",
            String.raw`backslash\'quote`
        ])("经真实 Compose 解析后密码保持原值：%#", async password => {
        const { envPath, runtimePath } = await fixture(
            "",
            translationConfig +
                smtpConfig.replace("test#password$literal", () => password)
        )
        expect(runUpdater(envPath, runtimePath).status).toBe(0)
        const composePath = join(envPath, "..", "compose.yaml")
        await writeFile(
            composePath,
            "services:\n  probe:\n    image: busybox\n    env_file: .env\n",
            "utf8"
        )
        const parsed = spawnSync(
            "docker",
            [
                "compose",
                "--env-file",
                envPath,
                "-f",
                composePath,
                "config",
                "--format",
                "json"
            ],
            { encoding: "utf8" }
        )

        expect(parsed.status).toBe(0)
        // compose config 会在渲染结果中再次将 $ 写成 $$；还原这一层展示转义。
        const rendered = JSON.parse(parsed.stdout).services.probe.environment
            .SMTP_PASS as string
        expect(rendered.replaceAll("$$", () => "$")).toBe(password)
    })

    it("未传入 SMTP 配置时保留服务器已有的发信配置", async () => {
        const current = "SMTP_HOST=smtp.old.example\nSMTP_PASS=old-password\n"
        const { envPath, runtimePath } = await fixture(
            current,
            translationConfig
        )

        expect(runUpdater(envPath, runtimePath).status).toBe(0)
        expect(await readFile(envPath, "utf8")).toContain(current)
    })

    it.each([
        "SMTP_HOST=smtp.gmail.com\n",
        smtpConfig.replace("SMTP_PORT=587", "SMTP_PORT=invalid"),
        smtpConfig.replace("SMTP_SECURE=false", "SMTP_SECURE=invalid"),
        smtpConfig.replace("SMTP_FROM=sender@example.com", "SMTP_FROM=invalid"),
        smtpConfig.replace(
            "SMTP_PASS=test#password$literal",
            "SMTP_PASS=test\rpassword"
        )
    ])("SMTP 配置不完整或非法时不改写服务器配置：%#", async incoming => {
        const original = "SMTP_PASS=old-password\n"
        const { envPath, runtimePath } = await fixture(
            original,
            translationConfig + incoming
        )
        const result = runUpdater(envPath, runtimePath)

        expect(result.status).not.toBe(0)
        expect(await readFile(envPath, "utf8")).toBe(original)
        expect(result.stdout + result.stderr).not.toContain(
            "test#password$literal"
        )
    })

    it("原子替换允许的上游配置并保留其他环境变量", async () => {
        const { envPath, runtimePath } = await fixture(
            "DATABASE_URL=file:/app/data/mewcat.db\nSILICONFLOW_API_KEY=old-key\nSILICONFLOW_BASE_URL=https://api.deepseek.com\nSILICONFLOW_MODEL=deepseek-flash\nALLOWED_ORIGINS=chrome-extension://oldoldoldoldoldoldoldoldoldoldol\n",
            "SILICONFLOW_API_KEY=sk-new-key\nSILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1\nSILICONFLOW_MODEL=deepseek-ai/DeepSeek-V4-Flash\nALLOWED_ORIGINS=chrome-extension://nnmceoehnacdjdpeeocdopnaejcnaibm,chrome-extension://hkmlfkldkaickokgmgongeimeikkeadb\n"
        )

        const result = runUpdater(envPath, runtimePath)

        expect(result.stderr).toBe("")
        expect(result.status).toBe(0)
        expect(await readFile(envPath, "utf8")).toBe(
            "DATABASE_URL=file:/app/data/mewcat.db\nSILICONFLOW_API_KEY=sk-new-key\nSILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1\nSILICONFLOW_MODEL=deepseek-ai/DeepSeek-V4-Flash\nALLOWED_ORIGINS=chrome-extension://nnmceoehnacdjdpeeocdopnaejcnaibm,chrome-extension://hkmlfkldkaickokgmgongeimeikkeadb\n"
        )
    })

    it("拒绝未知配置且不改写原文件", async () => {
        const original =
            "SILICONFLOW_API_KEY=old-key\nSILICONFLOW_MODEL=old-model\n"
        const { envPath, runtimePath } = await fixture(
            original,
            "SILICONFLOW_API_KEY=new-key\nUNEXPECTED_SECRET=leak\nSILICONFLOW_MODEL=new-model\n"
        )

        const result = runUpdater(envPath, runtimePath)

        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain("不允许的运行时配置")
        expect(await readFile(envPath, "utf8")).toBe(original)
    })

    it("拒绝带 UTF-8 BOM 的 API key 且不改写原文件", async () => {
        const original = "SILICONFLOW_API_KEY=sk-old-key\n"
        const { envPath, runtimePath } = await fixture(
            original,
            "SILICONFLOW_API_KEY=\ufeffsk-new-key\nSILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1\nSILICONFLOW_MODEL=deepseek-ai/DeepSeek-V4-Flash\nALLOWED_ORIGINS=chrome-extension://nnmceoehnacdjdpeeocdopnaejcnaibm\n"
        )

        const result = runUpdater(envPath, runtimePath)

        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain("SILICONFLOW_API_KEY 格式无效")
        expect(await readFile(envPath, "utf8")).toBe(original)
    })
})
