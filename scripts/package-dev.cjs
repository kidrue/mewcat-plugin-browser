#!/usr/bin/env node

/** 使用 WXT 生成可分发的开发模式 ZIP。 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const outputDir = path.join(__dirname, "..", ".output")
const source = path.join(outputDir, "chrome-mv3-prod.zip")
const destination = path.join(outputDir, "chrome-mv3-dev.zip")

try {
    execSync("pnpm exec wxt zip --mode development", { stdio: "inherit" })
    if (!fs.existsSync(source)) {
        throw new Error(`WXT ZIP not found: ${source}`)
    }
    if (fs.existsSync(destination)) {
        fs.rmSync(destination)
    }
    fs.renameSync(source, destination)

    const sizeInMb = (fs.statSync(destination).size / 1024 / 1024).toFixed(2)
    console.log(`✅ 打包完成: .output/chrome-mv3-dev.zip (${sizeInMb} MB)`)
} catch (error) {
    console.error("❌ 打包失败:", error.message)
    process.exit(1)
}
