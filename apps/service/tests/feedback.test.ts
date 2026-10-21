import { TranslationClient } from "@mewcat/client"
import {
    createIdentity,
    open,
    publicKeys,
    seal,
    type Identity,
    type ServerPublicKeys
} from "@mewcat/protocol"
import type { FastifyInstance } from "fastify"
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from "vitest"

import { buildApp } from "../src/app.js"
import { loadConfig } from "../src/config.js"
import { testStore } from "./helpers.js"

describe("加密反馈接口", () => {
    let identity: Identity
    let server: Identity
    let keys: ServerPublicKeys
    let fixture: Awaited<ReturnType<typeof testStore>>
    let app: FastifyInstance
    let client: TranslationClient
    const mailer = { send: vi.fn(async () => {}), close: vi.fn() }
    const input = {
        message: "网页翻译的按钮可以更明显一些。",
        replyEmail: "reader@example.com",
        extensionVersion: "1.0.4"
    }
    const config = loadConfig({
        NODE_ENV: "test",
        SILICONFLOW_API_KEY: "test",
        SILICONFLOW_MODEL: "test"
    })
    const fetcher: typeof fetch = async (url, init) => {
        const response = await app.inject({
            method: init?.method === "POST" ? "POST" : "GET",
            url: new URL(String(url)).pathname,
            ...(init?.body ? { payload: String(init.body) } : {}),
            headers: { "content-type": "application/json" }
        })
        return new Response(response.body, {
            status: response.statusCode,
            headers: { "content-type": "application/json" }
        })
    }
    beforeAll(async () => {
        identity = await createIdentity()
        server = await createIdentity()
        keys = await publicKeys(server, "server")
    })
    beforeEach(async () => {
        fixture = await testStore()
        mailer.send.mockReset().mockResolvedValue(undefined)
        mailer.close.mockClear()
        app = await buildApp({
            config,
            store: fixture.store,
            keys: { identity: server, publicKeys: keys, ipHashSecret: "test" },
            feedbackMailer: mailer
        })
        client = await TranslationClient.connect({
            baseUrl: "http://localhost:3000",
            state: { identity },
            fetcher
        })
        await client.register("feedback test")
    })
    afterEach(async () => {
        await app?.close()
        await fixture?.cleanup()
    })
    async function request(
        data: unknown,
        options: {
            nonce?: string
            ip?: string
            path?: string
            signer?: Identity
        } = {}
    ) {
        const clientId = client.getState().clientId!
        const envelope = await seal(
            {
                v: 1,
                method: "POST",
                path: options.path ?? "/v1/feedback",
                timestamp: Date.now(),
                nonce: options.nonce ?? crypto.randomUUID(),
                data
            },
            (options.signer ?? identity).signing.privateKey,
            server.encryption.publicKey,
            clientId,
            "server"
        )
        const response = await app.inject({
            method: "POST",
            url: "/v1/feedback",
            payload: { envelope },
            remoteAddress: options.ip ?? "127.0.0.1"
        })
        const payload = response.json().envelope
            ? await open(
                  response.json().envelope,
                  identity.encryption.privateKey,
                  server.signing.publicKey,
                  "server",
                  clientId
              )
            : response.json()
        return { response, payload }
    }
    it("接受反馈、清理空白，并且不消耗翻译额度或保存正文", async () => {
        const { response, payload } = await request({
            ...input,
            message: `  ${input.message}  `
        })
        expect(response.statusCode).toBe(201)
        expect(payload).toMatchObject({ ok: true, data: { accepted: true } })
        expect(mailer.send).toHaveBeenCalledWith(input)
        expect(await client.usage()).toMatchObject({ usedCharacters: 0 })
        expect(await fixture.store.db.translationRequest.count()).toBe(0)
        expect(
            JSON.stringify(await fixture.store.db.usageBucket.findMany())
        ).not.toContain(input.message)
    })
    it("SDK 使用相同加密通道提交反馈", async () => {
        expect(await client.submitFeedback(input)).toEqual({ accepted: true })
        expect(mailer.send).toHaveBeenCalledOnce()
    })
    it.each([
        { ...input, message: "    " },
        { ...input, message: "1234" },
        { ...input, message: "字".repeat(5001) },
        { ...input, replyEmail: "bad email" },
        { ...input, replyEmail: "reader@example.com\r\nBcc:evil@example.com" },
        { ...input, extensionVersion: "v1\r\nInjected:yes" },
        { ...input, to: "other@example.com" }
    ])("拒绝无效输入和客户端指定的收件人：%j", async data => {
        expect((await request(data)).response.statusCode).toBe(400)
        expect(mailer.send).not.toHaveBeenCalled()
    })
    it("同一请求重放不会重复发送邮件", async () => {
        const nonce = crypto.randomUUID()
        const results = await Promise.all(
            [1, 2, 3].map(() => request(input, { nonce }))
        )
        expect(results.map(r => r.response.statusCode).sort()).toEqual([
            201, 409, 409
        ])
        expect(mailer.send).toHaveBeenCalledOnce()
    })
    it("设备限流在独立反馈桶中原子执行", async () => {
        const results = await Promise.all(
            [1, 2, 3, 4].map(() => request(input))
        )
        expect(results.map(r => r.response.statusCode).sort()).toEqual([
            201, 201, 201, 429
        ])
        expect(mailer.send).toHaveBeenCalledTimes(3)
        expect(await client.usage()).toMatchObject({ usedCharacters: 0 })
    })
    it("无效签名、跨路径请求和停用设备不能发送邮件", async () => {
        expect(
            (await request(input, { signer: server })).response.statusCode
        ).toBe(401)
        expect(
            (await request(input, { path: "/v1/usage" })).response.statusCode
        ).toBe(401)
        await fixture.store.revokeClient(client.getState().clientId!)
        expect((await request(input)).response.statusCode).toBe(403)
        expect(mailer.send).not.toHaveBeenCalled()
    })
    it.each([
        [{ FEEDBACK_IP_REQUESTS_PER_HOUR: 1 }, "127.0.0.1"],
        [{ FEEDBACK_GLOBAL_REQUESTS_PER_DAY: 1 }, "127.0.0.2"]
    ])("IP 与全局反馈限额独立生效：%j", async (limits, secondIp) => {
        await app.close()
        app = await buildApp({
            config: { ...config, ...limits },
            store: fixture.store,
            keys: { identity: server, publicKeys: keys, ipHashSecret: "test" },
            feedbackMailer: mailer
        })
        expect((await request(input)).response.statusCode).toBe(201)
        expect(
            (await request(input, { ip: secondIp })).response.statusCode
        ).toBe(429)
        expect(mailer.send).toHaveBeenCalledOnce()
    })
    it("SMTP 未配置仅禁用反馈，健康检查和用量查询仍可用", async () => {
        await app.close()
        app = await buildApp({
            config,
            store: fixture.store,
            keys: { identity: server, publicKeys: keys, ipHashSecret: "test" }
        })
        expect((await request(input)).response.statusCode).toBe(503)
        expect((await app.inject({ url: "/health" })).statusCode).toBe(200)
        expect(await client.usage()).toMatchObject({ usedCharacters: 0 })
    })
    it("发送失败不返回成功，不自动重试或泄露错误内容", async () => {
        mailer.send.mockRejectedValue(
            new Error("SMTP password and private feedback")
        )
        const { response } = await request(input)
        expect(response.statusCode).toBe(502)
        expect(response.body).not.toContain("private feedback")
        expect(mailer.send).toHaveBeenCalledOnce()
    })
})
