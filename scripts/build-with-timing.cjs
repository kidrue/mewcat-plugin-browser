#!/usr/bin/env node
/** 显示 WXT 编译和打包各阶段耗时。 */

const { execSync } = require("child_process")
const chalk = require("chalk")

function formatTime(ms) {
    return `${(ms / 1000).toFixed(2)}s`
}

function runCommand(name, command) {
    console.log(chalk.cyan(`\n▶ ${name}...`))
    const start = Date.now()

    try {
        execSync(command, { stdio: "inherit" })
        const duration = Date.now() - start
        console.log(
            chalk.green(`✓ ${name} 完成`) +
                chalk.gray(` (${formatTime(duration)})`)
        )
        return duration
    } catch {
        const duration = Date.now() - start
        console.log(
            chalk.red(`✗ ${name} 失败`) +
                chalk.gray(` (${formatTime(duration)})`)
        )
        process.exit(1)
    }
}

console.log(chalk.bold.blue("\n🚀 开始构建 mewCat 扩展\n"))
const totalStart = Date.now()

const wxtTime = runCommand("WXT 编译", "pnpm exec wxt build")
const cleanTime = runCommand("清理旧压缩包", "pnpm clean:prod:zip")
const zipTime = runCommand("生成压缩包", "pnpm package")
const totalTime = Date.now() - totalStart

console.log(chalk.bold.blue("\n📊 构建耗时统计\n"))
console.log(chalk.gray("─".repeat(40)))
console.log(
    `  WXT 编译         ${chalk.yellow(formatTime(wxtTime).padStart(10))}`
)
console.log(
    `  清理旧包         ${chalk.yellow(formatTime(cleanTime).padStart(10))}`
)
console.log(
    `  压缩打包         ${chalk.yellow(formatTime(zipTime).padStart(10))}`
)
console.log(chalk.gray("─".repeat(40)))
console.log(
    `  ${chalk.bold("总耗时")}           ${chalk.bold.green(
        formatTime(totalTime).padStart(10)
    )}`
)
console.log()
