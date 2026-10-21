import { spawnSync } from "node:child_process"

const result = spawnSync("docker", ["compose", "version"], {
    stdio: "inherit",
    windowsHide: true
})
if (result.error || result.status !== 0) {
    console.error(
        "Docker 专属验收需要 Docker Compose；请在 Linux CI 或已安装 Docker 的环境执行。"
    )
    process.exit(1)
}
