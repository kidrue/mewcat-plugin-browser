import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { parse } from "yaml"

import { affectedProjects } from "../scripts/affected-projects.mjs"

const workflows = Object.fromEntries(
    ["ci", "release-extension", "deploy-service"].map(name => [
        name,
        parse(
            readFileSync(
                new URL(`../.github/workflows/${name}.yml`, import.meta.url),
                "utf8"
            )
        )
    ])
)
const matches = (paths, file) =>
    paths.some(pattern =>
        pattern.endsWith("/**")
            ? file.startsWith(pattern.slice(0, -2))
            : file === pattern
    )

test("main 发布触发器与 PR 变更分类对同一组文件作出相同判断", () => {
    for (const file of [
        "apps/extension/src/popup/index.tsx",
        "apps/service/src/server.ts",
        ".dockerignore",
        "packages/mewcat-client/src/client.ts",
        "packages/mewcat-protocol/src/contracts.ts",
        "scripts/run-with-env.mjs",
        "tests/workflow-routing.test.mjs",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        ".npmrc",
        "prettier.config.mjs",
        ".prettierignore",
        ".github/workflows/ci.yml",
        ".github/workflows/release-extension.yml",
        ".github/workflows/deploy-service.yml",
        "README.md",
        "docs/monorepo.md"
    ]) {
        const expected = affectedProjects([file])
        assert.equal(
            matches(workflows["release-extension"].on.push.paths, file),
            expected.extension,
            file
        )
        assert.equal(
            matches(workflows["deploy-service"].on.push.paths, file),
            expected.service,
            file
        )
    }
})

test("文档 PR 仍有汇总检查，后端部署需要显式启用且在构建之后", () => {
    assert.ok(!workflows.ci.on.pull_request.paths)
    assert.equal(workflows.ci.jobs.result.if, "always()")
    assert.ok(workflows.ci.jobs.result.needs.includes("workspace"))
    const { build, deploy } = workflows["deploy-service"].jobs
    assert.ok(
        build.steps.some(step =>
            step.uses?.startsWith("actions/upload-artifact@")
        )
    )
    assert.equal(deploy.needs, "build")
    assert.match(deploy.if, /SERVICE_DEPLOY_ENABLED == 'true'/)
    assert.match(deploy.if, /refs\/heads\/main/)
    assert.ok(!build.environment)
    assert.equal(deploy.environment, "production")
    for (const workflow of Object.values(workflows)) {
        for (const job of Object.values(workflow.jobs)) {
            for (const step of job.steps ?? [])
                if (step.uses && !step.uses.startsWith("./"))
                    assert.match(step.uses, /@[a-f0-9]{40}$/, step.uses)
        }
    }
})
