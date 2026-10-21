import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("生产 Compose 配置", () => {
    it("未显式配置来源时交由应用读取构建中的仓库白名单", async () => {
        const compose = await readFile(
            new URL("../compose.yaml", import.meta.url),
            "utf8"
        )

        expect(compose).toContain('ALLOWED_ORIGINS: "${ALLOWED_ORIGINS:-}"')
    })

    it("自动部署会同步正式及开发扩展来源到服务器环境变量", async () => {
        const workflow = await readFile(
            new URL(
                "../../../.github/workflows/deploy-service.yml",
                import.meta.url
            ),
            "utf8"
        )

        expect(workflow).toContain(
            "printf 'ALLOWED_ORIGINS=%s\\n' \"$ALLOWED_ORIGINS\""
        )
    })
})
