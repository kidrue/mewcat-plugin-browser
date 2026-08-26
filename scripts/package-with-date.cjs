#!/usr/bin/env node

/** 使用 WXT 打包，并为生产 ZIP 增加日期后缀。 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const getDateSuffix = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${year}${month}${day}`
}

try {
    console.log("📦 Running wxt zip...")
    execSync("pnpm exec wxt zip", { stdio: "inherit" })

    const outputDir = path.join(process.cwd(), ".output")
    const source = path.join(outputDir, "chrome-mv3-prod.zip")
    const fileName = `chrome-mv3-prod-${getDateSuffix()}.zip`
    const destination = path.join(outputDir, fileName)

    if (!fs.existsSync(source)) {
        throw new Error(`WXT ZIP not found: ${source}`)
    }
    if (fs.existsSync(destination)) {
        fs.rmSync(destination)
    }

    fs.renameSync(source, destination)
    console.log(`✅ Package created successfully: .output/${fileName}`)
} catch (error) {
    console.error("❌ Error during packaging:", error.message)
    process.exit(1)
}
