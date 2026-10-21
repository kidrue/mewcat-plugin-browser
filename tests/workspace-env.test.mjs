import assert from "node:assert/strict"
import { once } from "node:events"
import { existsSync } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

test("应用脚本原样读取本地配置，进程环境优先且缺失文件可用于 CI", async () => {
    const moduleUrl = new URL("../scripts/run-with-env.mjs", import.meta.url)
    assert.ok(existsSync(moduleUrl), "尚未实现 workspace 环境加载")
    const { runPackageScript } = await import(moduleUrl.href)
    const directory = await mkdtemp(join(tmpdir(), "mewcat-workspace-env-"))
    try {
        await writeFile(
            join(directory, "package.json"),
            JSON.stringify({ scripts: { probe: "node probe.cjs" } })
        )
        await writeFile(
            join(directory, "probe.cjs"),
            "process.stdout.write(JSON.stringify({password:process.env.SMTP_PASS,empty:process.env.EMPTY,value:process.env.OVERRIDE}))"
        )
        const envFile = join(directory, ".env.local")
        await writeFile(
            envFile,
            'SMTP_PASS="literal$$pair#value"\nEMPTY=\nOVERRIDE=file\n'
        )
        const baseEnv = { ...process.env }
        delete baseEnv.SMTP_PASS
        delete baseEnv.EMPTY
        for (const [file, password, empty, loadLocal] of [
            [envFile, "literal$$pair#value", "", "true"],
            [join(directory, "missing.env"), undefined, undefined, "true"],
            [envFile, undefined, undefined, "false"]
        ]) {
            const child = runPackageScript({
                cwd: directory,
                script: "probe",
                envFile: file,
                env: {
                    ...baseEnv,
                    OVERRIDE: "process",
                    MEWCAT_LOAD_LOCAL_ENV: loadLocal
                },
                stdio: "pipe"
            })
            let output = ""
            let errors = ""
            child.stdout.on("data", part => (output += part))
            child.stderr.on("data", part => (errors += part))
            const [code] = await once(child, "exit")
            assert.equal(code, 0, errors)
            assert.deepEqual(JSON.parse(output), {
                ...(password === undefined ? {} : { password }),
                ...(empty === undefined ? {} : { empty }),
                value: "process"
            })
            assert.ok(!errors.includes("literal$$pair#value"))
        }
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
