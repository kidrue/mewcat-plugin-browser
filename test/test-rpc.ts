/**
 * gRPC/Connect 测试文件
 * 测试调用 ChatService 的 completion 方法
 */

import { createClient } from "@connectrpc/connect"
import { createConnectTransport } from "@connectrpc/connect-web"

import {
    ChatQueryModel,
    ChatService
} from "../src/es/chat/v1/chat_pb"

// 创建 transport
const transport = createConnectTransport({
    baseUrl: "https://api-dev.doc2x.noedgeai.com",
    useBinaryFormat: false,
    fetch
})

// 创建客户端
const client = createClient(ChatService, transport)

async function testCommonCompletion() {
    try {
        console.log("\n\n🚀 开始测试 CommonTranslate RPC 调用...\n")

        // 创建翻译请求
        const messages = [
            {
                role: "system",
                content: "你是一个专业的翻译助手"
            },
            {
                role: "user",
                content: "请将以下文本翻译成中文：Hello, how are you?"
            }
        ]
        console.log("📤 发送翻译请求:")
        // 调用 RPC
        const response = await client.completion(
            {
                messages: messages,
                modelOption: {
                    model: ChatQueryModel.DOUBAO_1d5_PRO,
                    tryCnt: 1
                },
                temperature: 0.1
            },
            {
                headers: {
                    authorization: "Bearer Chg2OGE0NWZjNGRjYzU4ZGQ1MmM0MGY4MzIQ56KXyJTHzfQ0.7862b85ba2ef529eef47399f817f0655df81f7bb2e7fa34f6811ac5fc5b8c268"
                }
            }
        )

        console.log("✅ 收到翻译响应:")
        console.log("  Content:", response)
    } catch (error: any) {
        console.error("❌ 翻译错误:", error.message)
        if (error.code) {
            console.error("  错误码:", error.code)
        }
    }
}

// 运行测试
console.log("=".repeat(60))
console.log("gRPC/Connect RPC 测试")
console.log("=".repeat(60))

testCommonCompletion().then(() => {
    console.log("\n" + "=".repeat(60))
    console.log("测试完成")
    console.log("=".repeat(60))
})
