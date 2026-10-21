import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { TranslationClient } from "../packages/mewcat-client/dist/index.js"

const directory = await mkdtemp(join(tmpdir(), "mewcat-container-smoke-"))
const project = `mewcat-ci-${process.pid}-${Date.now()}`
const config = join(directory, "compose.yaml")
const compose = args =>
    execFileSync("docker", ["compose", "-p", project, "-f", config, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
    })
await writeFile(
    config,
    `services:
  migrate:
    image: mewcat-tools:ci
    environment:
      DATABASE_URL: file:/app/data/mewcat.db
      KEYS_FILE: /app/secrets/server-keys.json
    volumes:
      - database:/app/data
      - keys:/app/secrets
  api:
    image: mewcat-api:ci
    depends_on:
      migrate:
        condition: service_completed_successfully
    environment:
      NODE_ENV: test
      HOST: 0.0.0.0
      PORT: "3000"
      DATABASE_URL: file:/app/data/mewcat.db
      KEYS_FILE: /app/secrets/server-keys.json
      SILICONFLOW_API_KEY: smoke-placeholder-never-used
      SILICONFLOW_MODEL: smoke-placeholder-never-used
      LOG_LEVEL: silent
    volumes:
      - database:/app/data
      - keys:/app/secrets:ro
    ports:
      - "127.0.0.1::3000"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 2s
      timeout: 3s
      retries: 30
volumes:
  database:
  keys:
`
)
try {
    compose([
        "run",
        "--rm",
        "--no-deps",
        "migrate",
        "node",
        "dist/scripts/admin.js",
        "keys"
    ])
    compose(["up", "-d", "--wait", "--wait-timeout", "120"])
    const address = compose(["port", "api", "3000"]).trim()
    assert.match(address, /^127\.0\.0\.1:\d+$/)
    const baseUrl = `http://${address}`
    assert.equal((await fetch(`${baseUrl}/health`)).status, 200)
    const client = await TranslationClient.connect({ baseUrl })
    assert.match(await client.register("container-smoke"), /^[0-9a-f-]{36}$/)
    assert.equal((await client.usage()).usedCharacters, 0)
    console.log(
        "容器验收通过：迁移镜像、运行镜像、健康检查及共享 SDK 注册/用量查询；未调用付费接口。"
    )
} catch (error) {
    console.error(compose(["logs", "--no-color"]))
    throw error
} finally {
    try {
        compose(["down", "--volumes", "--remove-orphans"])
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}
