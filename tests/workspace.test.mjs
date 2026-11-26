import assert from "node:assert/strict"
import { existsSync, readdirSync } from "node:fs"
import { test } from "node:test"

test("扩展组件根目录只允许 index.ts 作为单独文件", () => {
    const directory = new URL(
        "../apps/extension/src/components/",
        import.meta.url
    )
    const entries = readdirSync(directory, { withFileTypes: true })
    const standaloneFiles = entries
        .filter(entry => !entry.isDirectory())
        .map(entry => entry.name)

    assert.deepEqual(standaloneFiles, ["index.ts"])

    for (const entry of entries.filter(entry => entry.isDirectory())) {
        const component = new URL(`${entry.name}/`, directory)
        const members = readdirSync(component, { withFileTypes: true })

        assert.ok(
            members.some(
                member => member.isFile() && member.name === "index.ts"
            ),
            `${entry.name} 缺少 index.ts 导出入口`
        )
        assert.deepEqual(
            members
                .filter(member => member.isDirectory())
                .map(member => member.name),
            [],
            `${entry.name} 的组件和辅助文件应同级存放`
        )
    }
})

test("按整次变更识别应用和共享依赖，并处理重命名与删除路径", async () => {
    const moduleUrl = new URL(
        "../scripts/affected-projects.mjs",
        import.meta.url
    )
    assert.ok(existsSync(moduleUrl), "尚未实现 workspace 变更分类")
    const { affectedProjects } = await import(moduleUrl.href)
    for (const [files, expected] of [
        [
            ["apps/extension/src/pages/popup/index.tsx"],
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
