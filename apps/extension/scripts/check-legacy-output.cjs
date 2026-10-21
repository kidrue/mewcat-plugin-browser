#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

const legacyOutputDirectories = [
    "build/chrome-mv3-dev",
    "build/chrome-mv3-prod"
]

function findLegacyOutputs(projectRoot) {
    return legacyOutputDirectories.filter(relativeDirectory =>
        fs.existsSync(
            path.join(projectRoot, relativeDirectory, "manifest.json")
        )
    )
}

function warnAboutLegacyOutputs(
    projectRoot,
    writeWarning = message => console.warn(message)
) {
    const legacyOutputs = findLegacyOutputs(projectRoot)

    if (legacyOutputs.length === 0) {
        return false
    }

    writeWarning(
        [
            "\n⚠ 检测到旧版扩展构建目录，Chrome 可能仍在加载过期 UI：",
            ...legacyOutputs.map(directory => `  - ${directory}`),
            "",
            "请在 chrome://extensions 中移除旧目录对应的扩展，然后重新加载：",
            "  - 开发模式：.output/chrome-mv3-dev",
            "  - 生产构建：.output/chrome-mv3",
            ""
        ].join("\n")
    )

    return true
}

exports.findLegacyOutputs = findLegacyOutputs
exports.warnAboutLegacyOutputs = warnAboutLegacyOutputs

if (require.main === module) {
    warnAboutLegacyOutputs(path.resolve(__dirname, ".."))
}
