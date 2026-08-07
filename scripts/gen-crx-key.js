#!/usr/bin/env node

/**
 * 一次性工具：生成 crx 打包用的固定 RSA 私钥
 *
 * crx 的扩展 ID 由私钥推导而来，必须固定不变，否则每次发布的扩展 ID 都不同，
 * 已安装的用户将无法收到更新。
 *
 * 用法：
 *   node scripts/gen-crx-key.js
 *
 * 产出：
 *   1. 项目根目录的 key.pem（已被 .gitignore 排除，请离线备份）
 *   2. 终端打印的 base64 串，粘贴到 GitHub 仓库 Secret `CRX_PRIVATE_KEY_B64`
 */

const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const KEY_PATH = path.resolve(__dirname, "../key.pem")

const main = () => {
    if (fs.existsSync(KEY_PATH)) {
        console.error(`❌ key.pem 已存在：${KEY_PATH}`)
        console.error(
            "   覆盖会导致扩展 ID 变更、已安装用户无法升级。如确实要重新生成，请先手动删除并确认已备份。"
        )
        process.exit(1)
    }

    console.log("🔑 正在生成 RSA 2048 私钥...")

    // pkcs1（-----BEGIN RSA PRIVATE KEY-----）与 crx@3.0.1 期望的格式一致
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        privateKeyEncoding: {
            type: "pkcs1",
            format: "pem"
        },
        publicKeyEncoding: {
            type: "spki",
            format: "pem"
        }
    })

    // 私钥文件权限收紧到仅所有者可读写（Windows 上此调用为 no-op）
    fs.writeFileSync(KEY_PATH, privateKey, { encoding: "utf8", mode: 0o600 })

    const base64 = Buffer.from(privateKey, "utf8").toString("base64")

    console.log(`✅ 私钥已写入：${KEY_PATH}`)
    console.log("")
    console.log("=".repeat(72))
    console.log("请把下面这一整行 base64 存为 GitHub 仓库 Secret：CRX_PRIVATE_KEY_B64")
    console.log("Settings → Secrets and variables → Actions → New repository secret")
    console.log("=".repeat(72))
    console.log("")
    console.log(base64)
    console.log("")
    console.log("=".repeat(72))
    console.log("⚠️  同时请把 key.pem 离线备份一份。文件丢失后无法恢复，")
    console.log("   届时扩展 ID 会变更，已通过 crx 安装的用户将收不到更新。")
    console.log("=".repeat(72))
}

main()
