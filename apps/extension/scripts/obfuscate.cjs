const fs = require("fs")
const path = require("path")
const { obfuscate } = require("javascript-obfuscator")

// 要混淆的目录（WXT 构建输出目录）
const buildDir = path.resolve(__dirname, "../.output/chrome-mv3")

// 混淆配置
const obfuscateOptions = {
    // 混淆选项
    compact: true,
    // 简化代码
    simplify: true,
    // 检测调试器
    detectDebugger: true
}

// 递归遍历目录，混淆 .js 文件
function obfuscateDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
            obfuscateDir(fullPath) // 递归子目录
        } else if (stat.isFile() && path.extname(file) === ".js") {
            const code = fs.readFileSync(fullPath, "utf8")
            const obfuscatedCode = obfuscate(
                code,
                obfuscateOptions
            ).getObfuscatedCode()
            fs.writeFileSync(fullPath, obfuscatedCode, "utf8")
            console.log(`[混淆完成] ${fullPath}`)
        }
    })
}

obfuscateDir(buildDir)
