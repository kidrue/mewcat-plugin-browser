import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { test } from "node:test"

test("按整次变更识别应用和共享依赖，并处理重命名与删除路径", async () => {
    const moduleUrl = new URL(
        "../scripts/affected-projects.mjs",
        import.meta.url
    )
    assert.ok(existsSync(moduleUrl), "尚未实现 workspace 变更分类")
    const { affectedProjects } = await import(moduleUrl.href)
    for (const [files, expected] of [
        [
            ["apps/extension/src/popup/index.tsx"],
            { extension: true, service: false }
        ],
        [["apps/service/src/server.ts"], { extension: false, service: true }],
        [
            ["packages/mewcat-client/src/index.ts"],
            { extension: true, service: true }
        ],
        [
            ["packages/mewcat-protocol/src/index.ts"],
            { extension: true, service: true }
        ],
        [["pnpm-lock.yaml"], { extension: true, service: true }],
        [[".dockerignore"], { extension: false, service: true }],
        [["scripts/run-with-env.mjs"], { extension: true, service: true }],
        [[".github/workflows/ci.yml"], { extension: true, service: true }],
        [
            [".github/workflows/deploy-service.yml"],
            { extension: false, service: true }
        ],
        [
            ["README.md", "docs/monorepo.md"],
            { extension: false, service: false }
        ],
        [
            ["apps/extension/package.json", "apps/service/package.json"],
            { extension: true, service: true }
        ],
        [[], { extension: false, service: false }]
    ]) {
        assert.deepEqual(affectedProjects(files), expected, files.join(","))
    }
})
