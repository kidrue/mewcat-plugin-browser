import { spawnSync } from "node:child_process"

const targets = process.argv[2] ? [process.argv[2]] : ["extension", "service"]
for (const target of targets) {
    if (!["extension", "service"].includes(target))
        throw new Error("构建目标必须为 extension 或 service")
    const result = spawnSync(process.execPath, ["--run", `build:${target}`], {
        env: {
            ...process.env,
            MEWCAT_LOAD_LOCAL_ENV: "false",
            SENTRY_UPLOAD: "false"
        },
        stdio: "inherit",
        windowsHide: true
    })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
}
