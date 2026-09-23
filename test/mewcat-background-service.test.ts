import { beforeEach, describe, expect, it, vi } from "vitest"

import { MEWCAT_SERVICE_ORIGIN } from "@/constants/translationServices"
import {
    createMewCatService,
    type MewCatSdkAdapter
} from "@/background/lib/mewcat-service"

const identity = {
    signing: {} as CryptoKeyPair,
    encryption: {} as CryptoKeyPair
}

const createFixture = () => {
    let state = { identity } as { identity: typeof identity; clientId?: string }
    const translate = vi.fn(async ({ texts }: { texts: string[] }) => ({
        translations: texts.map(text => (text === "one" ? "一" : "二"))
    }))
    const register = vi.fn(async () => {
        state = { ...state, clientId: "client-id" }
        return state.clientId
    })
    const client = { getState: () => state, register, translate }
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
    return { sdk, client, register, translate, get state() { return state } }
}

describe("mewCat background 服务", () => {
    beforeEach(() => vi.restoreAllMocks())

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
        ).rejects.toThrow("temporary")
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
        fixture.sdk.TranslationClient.connect.mockImplementation(async options => {
            controlledFetch = options.fetcher
            return fixture.client
        })
        fixture.translate.mockImplementation(async () => {
            await controlledFetch?.("https://api.mewcat.kidrue.top/v1/translate")
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
        [
            new Error("服务器公钥与固定指纹不一致"),
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
