#!/usr/bin/env node

/**
 * 把 Plasmo 生产构建产物打包成签名的 .crx
 *
 * 前置条件：
 *   1. 先跑 `pnpm build`，产出 build/chrome-mv3-prod（已混淆）
 *   2. 提供固定私钥，二选一：
 *      - 环境变量 CRX_PRIVATE_KEY（PEM 明文，CI 用）
 *      - 项目根目录 key.pem（本地用，由 scripts/gen-crx-key.js 生成）
 *
 * 私钥必须固定：crx 的扩展 ID 由私钥推导，换密钥等于换扩展，已安装用户收不到更新。
 */

const ChromeExtension = require("crx")
const path = require("path")
const fs = require("fs")

const ROOT_DIR = path.resolve(__dirname, "..")
const SOURCE_DIR = path.join(ROOT_DIR, "build/chrome-mv3-prod")
const OUTPUT_DIR = path.join(ROOT_DIR, "release")
const PRIVATE_KEY_PATH = path.join(ROOT_DIR, "key.pem")

const { version } = require("../package.json")

const readPrivateKey = () => {
    const fromEnv = process.env.CRX_PRIVATE_KEY
    if (fromEnv && fromEnv.trim()) {
        console.log("🔑 使用环境变量 CRX_PRIVATE_KEY 中的私钥")
        return Buffer.from(fromEnv, "utf8")
    }

    if (fs.existsSync(PRIVATE_KEY_PATH)) {
        console.log(`🔑 使用私钥文件 ${PRIVATE_KEY_PATH}`)
        return fs.readFileSync(PRIVATE_KEY_PATH)
    }

    // 不再回退到「自动生成随机私钥」：那会让每次打包的扩展 ID 都不同
    throw new Error(
        "未找到签名私钥。请设置环境变量 CRX_PRIVATE_KEY，或在项目根目录放置 key.pem" +
            "（可用 `node scripts/gen-crx-key.js` 生成）。"
    )
}

const packCrx = async () => {
    if (!fs.existsSync(SOURCE_DIR)) {
        throw new Error(
            `构建产物不存在：${SOURCE_DIR}。请先执行 \`pnpm build\`。`
        )
    }

    const builder = new ChromeExtension({ privateKey: readPrivateKey() })

    // crx@3 的 load() 把源目录拷贝到临时工作区并返回实例本身（不会改动源目录），
    // 真正产出 crx Buffer 的是 pack()
    const loaded = await builder.load(SOURCE_DIR)
    const crxBuffer = await loaded.pack()
    const crxPath = path.join(OUTPUT_DIR, `mewcat-v${version}.crx`)

    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    fs.writeFileSync(crxPath, crxBuffer)

    console.log(`✅ CRX 打包完成：${crxPath}`)
}

packCrx().catch(err => {
    console.error("❌ 打包 CRX 出错:", err.message)
    process.exit(1)
})
