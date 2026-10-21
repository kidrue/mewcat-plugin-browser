#!/usr/bin/env node

/** 使用 WXT 打包，并以扩展名称、版本及北京时间命名生产 ZIP。 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const { createArtifactFileName } = require("./artifact-name.cjs")

function renameProductionZip(outputDir, now = new Date()) {
    const source = path.join(outputDir, "chrome-mv3-prod.zip")
    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(outputDir, "chrome-mv3", "manifest.json"),
            "utf8"
        )
    )
    const fileName = createArtifactFileName(manifest, "zip", now)
    const destination = path.join(outputDir, fileName)

    if (!fs.existsSync(source)) {
        throw new Error(`WXT ZIP not found: ${source}`)
    }
    if (fs.existsSync(destination)) {
        fs.rmSync(destination)
    }

    fs.renameSync(source, destination)
    return destination
}

module.exports = { renameProductionZip }

if (require.main === module) {
    try {
        console.log("📦 Running wxt zip...")
        execSync("pnpm exec wxt zip", { stdio: "inherit" })
        const destination = renameProductionZip(
            path.join(process.cwd(), ".output")
        )
        console.log(`✅ Package created successfully: ${destination}`)
    } catch (error) {
        console.error("❌ Error during packaging:", error.message)
        process.exit(1)
    }
}
