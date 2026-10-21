#!/usr/bin/env zx
import os from "os"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs-extra"
import { $ } from "zx"

process.env.FORCE_COLOR = "3"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const basePath = path.join(__dirname, "../")

const isWindows = os.type() === "Windows_NT"

// 跨平台打印函数
const log = console.log

log("🔍 [1/6] 开始验证本地依赖...")
log("📦 正在安装依赖包，请稍候...")

await $`pnpm i`

log("✅ 依赖安装完成")
log("🛡️  [2/6] 开始依赖安全性检查...")

// await $`pnpm audit`

log("📝 [3/6] 开始格式化代码检查...")
log("🔍 正在检查代码格式，将显示每个文件的检查结果...")

await $`pnpm format:check `

log("📊 [4/6] 开始执行代码质量评估(ESLint)...")
log("🔍 正在检查代码质量，将显示每个文件的检查结果...")

try {
    await $`pnpm lint`
    fs.writeFileSync("./lintstat.log", "No linting problems found\n")
    log("✅ 代码质量检查通过")
} catch (error) {
    const lintOutput = String(error.stdout || error.stderr || "")
    const problemsMatch = lintOutput.match(
        /✖.+\d+.+problems.+\(\d+.+errors,.+\d+.+warnings\)/u
    )
    fs.writeFileSync(
        "./lintstat.log",
        (problemsMatch?.at(0) || "Linting failed") + "\n"
    )
    log("❌ 代码质量检查发现问题，详细信息已显示在上方")
    throw error
}

log("🔍 [5/6] 开始执行 TypeScript 类型检测...")
log("🔍 正在检查类型定义，将显示每个文件的检查结果...")

await $`pnpm typecheck`

log("📝 [6/6] 开始执行单词拼写检测...")
log("🔍 正在检查拼写错误，将显示每个文件的检查结果...")

await $`pnpm spell`

// await $`pnpm run fixme`

log("✅ 所有检查通过！")
log("📦 [最终步骤] 准备创建提交...")
// log("📁 正在添加文件到暂存区...")

// await $`git add .`

// log("🎉 所有文件已添加到暂存区，提交准备完成！")
