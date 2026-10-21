import { beforeEach, describe, expect, it, vi } from "vitest"

import {
    createMewCatService,
    type MewCatSdkAdapter
} from "@/background/lib/mewcat-service"
import { MEWCAT_SERVICE_ORIGIN } from "@/constants/translationServices"
import type { MewCatRequestOptions } from "@mewcat/client"
import { TranslationError } from "@mewcat/client"

const identity = {
    signing: {} as CryptoKeyPair,
    encryption: {} as CryptoKeyPair
}

const createFixture = () => {
    let state = { identity } as { identity: typeof identity; clientId?: string }
    const translate = vi.fn(
        async (
            { texts }: { texts: string[] },
            _options?: MewCatRequestOptions
        ) => ({
            translations: texts.map(text => (text === "one" ? "一" : "二"))
        })
    )
    const register = vi.fn(async () => {
        state = { ...state, clientId: "client-id" }
        return state.clientId
    })
    const submitFeedback = vi.fn(
        async (
            _input: { message: string },
            _options?: MewCatRequestOptions
        ) => ({ accepted: true as const })
    )
    const client = {
        getState: () => state,
        register,
        translate,
        submitFeedback
    }
    const sdk = {
        TranslationClient: {
            connect: vi.fn(async options => {
                if (options.state) {
                    state = options.state
                }
                return client
            })
        },
        loadClientState: vi.fn(async () => undefined),
        saveClientState: vi.fn(async () => undefined)
    } satisfies MewCatSdkAdapter
    return {
        sdk,
        client,
        register,
        translate,
        submitFeedback,
        get state() {
            return state
        }
    }
}

describe("mewCat background 服务", () => {
    beforeEach(() => vi.restoreAllMocks())

    it.each(["feedback", "translate"])(
        "SDK 以实例方法调用默认 fetch 时保持 WorkerGlobalScope 接收者：%s",
        async operation => {
            const fixture = createFixture()
            const nativeFetch = vi
                .spyOn(globalThis, "fetch")
                .mockImplementation(async function (this: unknown) {
                    if (this !== globalThis) {
                        throw new TypeError(
                            "Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation"
                        )
                    }
                    return Response.json({})
                })
            fixture.sdk.TranslationClient.connect.mockImplementation(
                async options => {
                    const transport = { fetcher: options.fetcher! }
                    fixture.submitFeedback.mockImplementation(async () => {
                        await transport.fetcher(
                            `${MEWCAT_SERVICE_ORIGIN}/v1/feedback`
                        )
                        return { accepted: true }
                    })
                    fixture.translate.mockImplementation(async () => {
                        await transport.fetcher(
                            `${MEWCAT_SERVICE_ORIGIN}/v1/translate`
                        )
                        return { translations: ["一"] }
                    })
                    return fixture.client
                }
            )
            const service = createMewCatService({ sdk: fixture.sdk })

            if (operation === "feedback") {
                await expect(
                    service.submitFeedback({
                        message: "请改进翻译按钮",
                        extensionVersion: "1.0.4"
                    })
                ).resolves.toEqual({ accepted: true })
            } else {
                await expect(
                    service.translate({
                        texts: ["one"],
                        targetLanguage: "zh-CN"
                    })
                ).resolves.toEqual(["一"])
            }
            expect(nativeFetch).toHaveBeenCalledOnce()
        }
    )

    it("共享初始化尚未完成时，取消翻译立即结束等待但保留反馈", async () => {
        const fixture = createFixture()
        let connect!: (value: typeof fixture.client) => void
        fixture.sdk.TranslationClient.connect.mockReturnValue(
            new Promise(resolve => {
                connect = resolve
            })
        )
        const service = createMewCatService({ sdk: fixture.sdk })
        let cancellation: string | undefined
        const translation = service
            .translate({ texts: ["one"], targetLanguage: "zh-CN" })
            .catch(error => {
                cancellation = error.message
            })
        const feedback = service.submitFeedback({
            message: "请改进翻译按钮",
            extensionVersion: "1.0.4"
        })
        await vi.waitFor(() =>
            expect(fixture.sdk.TranslationClient.connect).toHaveBeenCalledOnce()
        )
        service.abortAll()
        try {
            await vi.waitFor(() =>
                expect(cancellation).toBe("mewCat 翻译请求已取消")
            )
            expect(fixture.translate).not.toHaveBeenCalled()
        } finally {
            connect(fixture.client)
            await translation
            await expect(feedback).resolves.toEqual({ accepted: true })
        }
    })

    it("反馈超时覆盖等待设备初始化的阶段", async () => {
        const fixture = createFixture()
        const deadline = new AbortController()
        vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(deadline.signal)
        let connect!: (value: typeof fixture.client) => void
        fixture.sdk.TranslationClient.connect.mockReturnValue(
            new Promise(resolve => {
                connect = resolve
            })
        )
        const service = createMewCatService({ sdk: fixture.sdk })
        let failure: string | undefined
        const feedback = service
            .submitFeedback({
                message: "请改进翻译按钮",
                extensionVersion: "1.0.4"
            })
            .catch(error => {
                failure = error.message
            })
        await vi.waitFor(() =>
            expect(fixture.sdk.TranslationClient.connect).toHaveBeenCalledOnce()
        )
        deadline.abort(new DOMException("test deadline", "TimeoutError"))
        try {
            await vi.waitFor(() => expect(failure).toContain("反馈发送超时"))
            expect(fixture.submitFeedback).not.toHaveBeenCalled()
        } finally {
            connect(fixture.client)
            await feedback
        }
    })

    it("反馈和翻译的并发首次请求共用一个设备身份", async () => {
        const fixture = createFixture()
        const service = createMewCatService({ sdk: fixture.sdk })
        const [feedback] = await Promise.all([
            service.submitFeedback({
                message: "请改进翻译按钮",
                extensionVersion: "1.0.4"
            }),
            service.translate({ texts: ["one"], targetLanguage: "zh-CN" })
        ])
        expect(feedback).toEqual({ accepted: true })
        expect(fixture.register).toHaveBeenCalledOnce()
        expect(fixture.sdk.TranslationClient.connect).toHaveBeenCalledOnce()
    })

    it("取消翻译不会取消同时发送的反馈", async () => {
        const fixture = createFixture()
        let transport: typeof fetch
        fixture.sdk.TranslationClient.connect.mockImplementation(
            async options => {
                transport = options.fetcher!
                return fixture.client
            }
        )
        fixture.translate.mockImplementation(async (_input, options) => {
            await transport("https://api.mewcat.kidrue.top/v1/translate", {
                signal: options?.signal
            })
            return { translations: ["一"] }
        })
        fixture.submitFeedback.mockImplementation(async (_input, options) => {
            await transport("https://api.mewcat.kidrue.top/v1/feedback", {
                signal: options?.signal
            })
            return { accepted: true }
        })
        let finishFeedback: () => void
        const fetchImpl = vi.fn(
            async (url: RequestInfo | URL, init?: RequestInit) =>
                new Promise<Response>((resolve, reject) => {
                    init?.signal?.addEventListener(
                        "abort",
                        () => reject(init.signal?.reason),
                        { once: true }
                    )
                    if (String(url).endsWith("/feedback"))
                        finishFeedback = () => resolve(Response.json({}))
                })
        ) as typeof fetch
        const service = createMewCatService({ sdk: fixture.sdk, fetchImpl })
        const feedback = service.submitFeedback({
            message: "请改进翻译按钮",
            extensionVersion: "1.0.4"
        })
        const translation = service.translate({
            texts: ["one"],
            targetLanguage: "zh-CN"
        })
        const canceled =
            expect(translation).rejects.toThrow("mewCat 翻译请求已取消")
        await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
        service.abortAll()
        await canceled
        finishFeedback!()
        await expect(feedback).resolves.toEqual({ accepted: true })
    })

    it("服务端未部署反馈接口时提示服务不可用，不误报网络故障或重试", async () => {
        const fixture = createFixture()
        fixture.submitFeedback.mockRejectedValue(
            new TranslationError(
                "REQUEST_REJECTED",
                "请求被拒绝（HTTP 404）",
                404
            )
        )
        const service = createMewCatService({ sdk: fixture.sdk })

        await expect(
            service.submitFeedback({
                message: "请改进翻译按钮",
                extensionVersion: "1.0.4"
            })
        ).rejects.toThrow("反馈服务暂不可用，请稍后重试")
        expect(fixture.submitFeedback).toHaveBeenCalledOnce()
    })

    it.each(["toString", "constructor", "__proto__", "UNKNOWN_ERROR"])(
        "未知反馈错误码始终返回安全的通用提示：%s",
        async code => {
            const fixture = createFixture()
            fixture.submitFeedback.mockRejectedValue(
                Object.assign(new Error("private SMTP details"), { code })
            )
            const service = createMewCatService({ sdk: fixture.sdk })

            await expect(
                service.submitFeedback({
                    message: "请改进翻译按钮",
                    extensionVersion: "1.0.4"
                })
            ).rejects.toThrow("无法提交反馈，请检查网络后重试")
            expect(fixture.submitFeedback).toHaveBeenCalledOnce()
        }
    )

    it.each([
        "FEEDBACK_UNAVAILABLE",
        "FEEDBACK_SEND_FAILED",
        "FEEDBACK_TIMEOUT",
        "RATE_LIMITED",
        "QUOTA_EXCEEDED"
    ])("反馈错误有独立提示，不重试或透出私密信息：%s", async code => {
        const fixture = createFixture()
        fixture.submitFeedback.mockRejectedValue(
            Object.assign(new Error("secret SMTP details"), { code })
        )
        const service = createMewCatService({ sdk: fixture.sdk })
        const result = service.submitFeedback({
            message: "请改进翻译按钮",
            extensionVersion: "1.0.4"
        })
        await expect(result).rejects.toThrow(/反馈/)
        await expect(result).rejects.not.toThrow(/secret|免费翻译/)
        expect(fixture.submitFeedback).toHaveBeenCalledOnce()
    })

    it("并发首次翻译只初始化并注册一个设备", async () => {
        const fixture = createFixture()
        const service = createMewCatService({ sdk: fixture.sdk })

        const [first, second] = await Promise.all([
            service.translate({ texts: ["one"], targetLanguage: "zh-CN" }),
            service.translate({ texts: ["two"], targetLanguage: "zh-CN" })
        ])

        expect(fixture.sdk.TranslationClient.connect).toHaveBeenCalledTimes(1)
        expect(fixture.register).toHaveBeenCalledTimes(1)
        expect(fixture.sdk.saveClientState).toHaveBeenNthCalledWith(
            1,
            MEWCAT_SERVICE_ORIGIN,
            { identity }
        )
        expect(fixture.sdk.saveClientState).toHaveBeenLastCalledWith(
            MEWCAT_SERVICE_ORIGIN,
            { identity, clientId: "client-id" }
        )
        expect(first).toEqual(["一"])
        expect(second).toEqual(["二"])
    })

    it("恢复已有 clientId 时不重复注册", async () => {
        const fixture = createFixture()
        fixture.sdk.loadClientState.mockResolvedValue({
            identity,
            clientId: "saved-client"
        })
        const service = createMewCatService({ sdk: fixture.sdk })

        await service.translate({ texts: ["one"], targetLanguage: "zh-CN" })

        expect(fixture.register).not.toHaveBeenCalled()
        expect(fixture.sdk.saveClientState).not.toHaveBeenCalled()
    })

    it("初始化失败后允许下一次操作重试", async () => {
        const fixture = createFixture()
        fixture.sdk.TranslationClient.connect.mockRejectedValueOnce(
            new Error("temporary")
        )
        const service = createMewCatService({ sdk: fixture.sdk })

        await expect(
            service.translate({ texts: ["one"], targetLanguage: "zh-CN" })
        ).rejects.toThrow("免费翻译服务请求失败")
        await expect(
            service.translate({ texts: ["one"], targetLanguage: "zh-CN" })
        ).resolves.toEqual(["一"])
        expect(fixture.sdk.TranslationClient.connect).toHaveBeenCalledTimes(2)
    })

    it("额度错误不会自动重试", async () => {
        const fixture = createFixture()
        fixture.translate.mockRejectedValue(
            Object.assign(new Error("quota"), { code: "QUOTA_EXCEEDED" })
        )
        const service = createMewCatService({ sdk: fixture.sdk })

        await expect(
            service.translate({ texts: ["one"], targetLanguage: "zh-CN" })
        ).rejects.toThrow("今日免费翻译额度已用完")
        expect(fixture.translate).toHaveBeenCalledTimes(1)
    })

    it("abortAll 取消正在进行的 SDK 请求", async () => {
        const fixture = createFixture()
        let controlledFetch: typeof fetch | undefined
        fixture.sdk.TranslationClient.connect.mockImplementation(
            async options => {
                controlledFetch = options.fetcher
                return fixture.client
            }
        )
        fixture.translate.mockImplementation(async (_input, options) => {
            await controlledFetch?.(
                "https://api.mewcat.kidrue.top/v1/translate",
                { signal: options?.signal }
            )
            return { translations: ["不应返回"] }
        })
        const fetchImpl = vi.fn(
            async (_input: RequestInfo | URL, init?: RequestInit) =>
                await new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener(
                        "abort",
                        () => reject(init.signal?.reason),
                        { once: true }
                    )
                })
        ) as typeof fetch
        const service = createMewCatService({ sdk: fixture.sdk, fetchImpl })

        const pending = service.translate({
            texts: ["one"],
            targetLanguage: "zh-CN"
        })
        await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1))
        service.abortAll()

        await expect(pending).rejects.toThrow("mewCat 翻译请求已取消")
        expect(fixture.translate).toHaveBeenCalledTimes(1)
    })

    it.each([
        [new DOMException("timeout", "TimeoutError"), "mewCat 翻译请求超时"],
        [new DOMException("aborted", "AbortError"), "mewCat 翻译请求超时"],
        [new TypeError("Failed to fetch"), "无法连接免费翻译服务"],
        [new Error("服务器公钥与固定指纹不一致"), "mewCat 服务身份校验失败"],
        [new Error("服务器响应关联或时间校验失败"), "mewCat 服务身份校验失败"],
        [
            Object.assign(new Error("decrypt details"), {
                code: "ERR_JWE_DECRYPTION_FAILED"
            }),
            "mewCat 服务身份校验失败"
        ],
        [
            Object.assign(new Error("signature details"), {
                code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED"
            }),
            "mewCat 服务身份校验失败"
        ]
    ])("映射 SDK 错误：%s", async (error, message) => {
        const fixture = createFixture()
        fixture.sdk.TranslationClient.connect.mockRejectedValue(error)
        const service = createMewCatService({ sdk: fixture.sdk })

        await expect(
            service.translate({ texts: ["one"], targetLanguage: "zh-CN" })
        ).rejects.toThrow(message)
        expect(fixture.translate).not.toHaveBeenCalled()
    })
})
