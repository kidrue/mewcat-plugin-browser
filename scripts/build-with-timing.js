#!/usr/bin/env node
/**
 * 带计时的构建脚本
 * 显示 Plasmo 编译、打包压缩各阶段的耗时
 */

const { execSync } = require('child_process')
const chalk = require('chalk')

// 格式化耗时显示（秒）
function formatTime(ms) {
    return (ms / 1000).toFixed(2) + 's'
}

// 执行命令并计时
function runCommand(name, command) {
    console.log(chalk.cyan(`\n▶ ${name}...`))
    const start = Date.now()

    try {
        execSync(command, { stdio: 'inherit' })
        const duration = Date.now() - start
        console.log(chalk.green(`✓ ${name} 完成`) + chalk.gray(` (${formatTime(duration)})`))
        return duration
    } catch (error) {
        const duration = Date.now() - start
        console.log(chalk.red(`✗ ${name} 失败`) + chalk.gray(` (${formatTime(duration)})`))
        process.exit(1)
    }
}

// 主流程
console.log(chalk.bold.blue('\n🚀 开始构建 mewCat 扩展\n'))
const totalStart = Date.now()

// 1. Plasmo 编译
const plasmoTime = runCommand('Plasmo 编译', 'plasmo build')

// 2. 清理旧 zip
const cleanTime = runCommand('清理旧压缩包', 'pnpm clean:prod:zip')

// 3. 打包 zip
const zipTime = runCommand('生成压缩包', 'pnpm package')

// 总计
const totalTime = Date.now() - totalStart

// 汇总报告
console.log(chalk.bold.blue('\n📊 构建耗时统计\n'))
console.log(chalk.gray('─'.repeat(40)))
console.log(`  Plasmo 编译      ${chalk.yellow(formatTime(plasmoTime).padStart(10))}`)
console.log(`  清理旧包        ${chalk.yellow(formatTime(cleanTime).padStart(10))}`)
console.log(`  压缩打包        ${chalk.yellow(formatTime(zipTime).padStart(10))}`)
console.log(chalk.gray('─'.repeat(40)))
console.log(`  ${chalk.bold('总耗时')}          ${chalk.bold.green(formatTime(totalTime).padStart(10))}`)
console.log()
