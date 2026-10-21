import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { parseEnv } from "node:util"

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url))

export function runPackageScript({
    cwd = process.cwd(),
    script,
    args = [],
    envFile = resolve(workspaceRoot, ".env.local"),
    env = process.env,
    stdio = "inherit"
}) {
    const local =
        env.MEWCAT_LOAD_LOCAL_ENV === "false" || !existsSync(envFile)
            ? {}
            : parseEnv(readFileSync(envFile, "utf8"))
    return spawn(process.execPath, ["--run", script, "--", ...args], {
        cwd,
        env: { ...local, ...env },
        stdio,
        windowsHide: true
    })
}

if (
    process.argv[1] &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
    const script = process.argv[2]
    if (!script) throw new Error("请提供需要运行的应用脚本名")
    const child = runPackageScript({ script, args: process.argv.slice(3) })
    child.once("error", error => {
        console.error(`应用命令启动失败：${error.message}`)
        process.exitCode = 1
    })
    child.once("exit", code => (process.exitCode = code ?? 1))
}
