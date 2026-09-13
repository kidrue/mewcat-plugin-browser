#!/usr/bin/env node

const { execFileSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const { loadEnv } = require("vite")

function listSourceMaps(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name)
        if (entry.isDirectory()) return listSourceMaps(file)
        return entry.isFile() && entry.name.endsWith(".map") ? [file] : []
    })
}

function uploadSentrySourceMaps({
    outputDir,
    version,
    env = { ...loadEnv("production", process.cwd(), ""), ...process.env },
    runCli = args =>
        execFileSync(
            process.execPath,
            [require.resolve("@sentry/cli/bin/sentry-cli"), ...args],
            { env, stdio: "pipe" }
        )
}) {
    const output = fs.realpathSync(outputDir)
    const outputRoot = path.resolve(process.cwd(), ".output")
    if (!output.startsWith(`${outputRoot}${path.sep}`)) {
        throw new Error("Source Map 输出目录不在 .output 内")
    }

    const maps = listSourceMaps(output)
    const required = ["WXT_SENTRY_DSN", "SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_AUTH_TOKEN"]
    const missing = required.filter(name => !env[name]?.trim())
    const configured = missing.length === 0
    if (missing.length > 0 && missing.length < required.length) {
        throw new Error(`Sentry 构建配置缺失：${missing.join(", ")}`)
    }

    if (configured && maps.length > 0) {
        runCli(["sourcemaps", "inject", output, "--quiet"])
        runCli([
            "sourcemaps", "upload",
            "--org", env.SENTRY_ORG,
            "--project", env.SENTRY_PROJECT,
            "--release", `mewcat@${version}`,
            "--quiet",
            output
        ])
    }
    for (const file of maps) fs.rmSync(file)
    return configured && maps.length > 0 ? "uploaded" : "skipped"
}

module.exports = { uploadSentrySourceMaps }

if (require.main === module) {
    try {
        const version = require("../package.json").version
        const result = uploadSentrySourceMaps({ outputDir: process.argv[2], version })
        console.log(`Sentry Source Map：${result}`)
    } catch (error) {
        console.error(`Sentry Source Map 处理失败：${error.message}`)
        process.exitCode = 1
    }
}
