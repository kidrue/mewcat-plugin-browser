import { describe, expect, it } from "vitest"

import { createProvider } from "../src/provider.js"

const settings = {
    apiKey: "server-only-key",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "configured-model",
    timeoutMs: 30,
    maxTokens: 2048
}
const request = {
    texts: ["hello", "world"],
    sourceLanguage: "auto",
    targetLanguage: "zh-CN"
}

describe("硅基流动接口边界", () => {
    it("发送固定模型与翻译提示词，按原顺序返回校验后的译文", async () => {
        let sent: Record<string, unknown> | undefined
        const provider = createProvider(settings, async (url, init) => {
            expect(url).toBe("https://api.siliconflow.cn/v1/chat/completions")
            expect(new Headers(init?.headers).get("Authorization")).toBe(
                "Bearer server-only-key"
            )
            sent = JSON.parse(String(init?.body)) as Record<string, unknown>
            return Response.json({
                choices: [
                    {
                        message: {
                            content: '{"translations":["你好","世界"]}'
                        },
                        finish_reason: "stop"
                    }
                ],
                usage: { prompt_tokens: 12, completion_tokens: 6 }
            })
        })
        expect(await provider.translate(request)).toEqual({
            translations: ["你好", "世界"],
            promptTokens: 12,
            completionTokens: 6
        })
        expect(sent).toMatchObject({
            model: "configured-model",
            stream: false,
            max_tokens: 2048,
            enable_thinking: false
        })
        expect(sent?.messages).toEqual([
            expect.objectContaining({
                role: "system",
                content: expect.stringContaining("translation")
            }),
            { role: "user", content: JSON.stringify(request) }
        ])
    })

    it("DeepSeek 官方接口使用其非思考参数", async () => {
        let sent: Record<string, unknown> | undefined
        const provider = createProvider(
            { ...settings, baseUrl: "https://api.deepseek.com" },
            async (_url, init) => {
                sent = JSON.parse(String(init?.body)) as Record<string, unknown>
                return Response.json({
                    choices: [
                        {
                            message: {
                                content: '{"translations":["你好","世界"]}'
                            },
                            finish_reason: "stop"
                        }
                    ]
                })
            }
        )

        await provider.translate(request)

        expect(sent).toMatchObject({ thinking: { type: "disabled" } })
        expect(sent).not.toHaveProperty("enable_thinking")
    })

    it.each([
        {
            choices: [
                {
                    message: { content: '{"translations":["你好"]}' },
                    finish_reason: "stop"
                }
            ]
        },
        {
            choices: [
                {
                    message: { content: "```not json```" },
                    finish_reason: "stop"
                }
            ]
        },
        {
            choices: [
                {
                    message: { content: '{"translations":["你好","世界"]}' },
                    finish_reason: "length"
                }
            ]
        },
        { choices: [] }
    ])("拒绝数量错误、格式错误或被截断的译文", async body => {
        const provider = createProvider(settings, async () =>
            Response.json(body)
        )
        await expect(provider.translate(request)).rejects.toMatchObject({
            code: "UPSTREAM_INVALID_RESPONSE"
        })
    })

    it("上游错误不暴露 API Key 或响应正文", async () => {
        const provider = createProvider(
            settings,
            async () =>
                new Response("server-only-key private diagnostics", {
                    status: 401
                })
        )
        await expect(provider.translate(request)).rejects.toMatchObject({
            code: "UPSTREAM_UNAVAILABLE",
            status: 502
        })
        try {
            await provider.translate(request)
        } catch (error) {
            expect(String(error)).not.toContain("server-only-key")
        }
    })

    it("请求超时会中止上游请求", async () => {
        const provider = createProvider(
            settings,
            async (_url, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener(
                        "abort",
                        () => reject(init.signal?.reason),
                        { once: true }
                    )
                })
        )
        await expect(provider.translate(request)).rejects.toMatchObject({
            code: "UPSTREAM_TIMEOUT",
            status: 504
        })
    })
})
