import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const commonFiles = new Set([
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    ".npmrc",
    "prettier.config.mjs",
    ".prettierignore",
    "eslint.config.mjs",
    "tsconfig.json",
    ".github/workflows/ci.yml"
])

export function affectedProjects(files) {
    const result = { extension: false, service: false }
    for (const file of files) {
        if (
            commonFiles.has(file) ||
            file.startsWith("packages/") ||
            file.startsWith("scripts/") ||
            file.startsWith("tests/")
        ) {
            result.extension = true
            result.service = true
        }
        if (
            file.startsWith("apps/extension/") ||
            file === ".github/workflows/release-extension.yml"
        )
            result.extension = true
        if (
            file.startsWith("apps/service/") ||
            file === ".dockerignore" ||
            file === ".github/workflows/deploy-service.yml"
        )
            result.service = true
    }
    return result
}

if (
    process.argv[1] &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
    let [base, head = "HEAD"] = process.argv.slice(2)
    if (!base || /^0+$/.test(base))
        base = execFileSync("git", ["hash-object", "-t", "tree", "--stdin"], {
            input: "",
            encoding: "utf8"
        }).trim()
    const range =
        process.env.GITHUB_EVENT_NAME === "pull_request"
            ? `${base}...${head}`
            : `${base}..${head}`
    const files = execFileSync(
        "git",
        ["diff", "--no-renames", "--name-only", "-z", range],
        { encoding: "utf8" }
    )
        .split("\0")
        .filter(Boolean)
    const result = affectedProjects(files)
    if (process.env.GITHUB_OUTPUT)
        appendFileSync(
            process.env.GITHUB_OUTPUT,
            Object.entries(result)
                .map(([name, value]) => `${name}=${value}\n`)
                .join("")
        )
    console.log(JSON.stringify(result))
}
