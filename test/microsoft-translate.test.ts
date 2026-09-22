import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    getTranslationServiceOptions,
    resolveTranslationServiceId
} from "../src/state/translationService"
import type { TranslateRequestSender } from "../src/translation/GoogleTranslator"
import { MicrosoftTranslator } from "../src/translation/MicrosoftTranslator"
import {
    translateBatch,
    translateText
} from "../src/translation/translationService"
import { AiRole } from "../src/types"
import { RequestType } from "../src/types/request"

let handleTranslateRequest: typeof import("../src/background/messages/translate-request").handleTranslateRequest
beforeEach(async () => {
    vi.resetModules()
    ;({ handleTranslateRequest } = await import(
        "../src/background/messages/translate-request"
    ))
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})
const config = {
    currentModel: "microsoft-translate",
    aiModelList: [],
    aiRole: AiRole.DEFAULT
}
const page =
    'IG:"test-ig"; var params_AbusePreventionHelper = [123,"test-token",3600000]; <div data-iid="translator.5023">'
const request = (timeout?: number, targetLanguage = "zh-CN") =>
    handleTranslateRequest({
        type: RequestType.MICROSOFT_TRANSLATE,
        config: { text: "Hello", targetLanguage, timeout }
    })

describe("Microsoft free translation", () => {
    it("splits long text within the provider limit without breaking Unicode or batch boundaries", async () => {
        const texts: string[] = []
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url: string, init: RequestInit) => {
                if (url.endsWith("/translator")) return new Response(page)
                const text = (init.body as URLSearchParams).get("text")!
                texts.push(text)
                return new Response(
                    JSON.stringify([{ translations: [{ text }] }])
                )
            })
        )
        const translator = new MicrosoftTranslator(handleTranslateRequest)
        const longText = "a".repeat(4999) + "😀" + "b".repeat(5000)
        expect(
            await translator.translateText(
                [{ role: "user", content: longText }],
                "zh-CN"
            )
        ).toBe(longText)
        expect(
            await translator.translateBatch(
                [
                    { role: "user", content: longText },
                    { role: "user", content: "tail" }
                ],
                "zh-CN"
            )
        ).toBe(longText + "\n\n%%\n\ntail")
        for (const text of texts) {
            expect(text.length).toBeLessThanOrEqual(5000)
            expect(text).not.toMatch(/[\uD800-\uDBFF]$/u)
            expect(text).not.toMatch(/^[\uDC00-\uDFFF]/u)
        }
    })
    it("preserves the selected free service and exposes it in selectors", () => {
        expect(resolveTranslationServiceId(config)).toBe("microsoft-translate")
        expect(getTranslationServiceOptions([])).toContainEqual({
            value: "microsoft-translate",
            label: "微软翻译（免费）"
        })
    })
    it("routes text and batches to Microsoft without an AI model", async () => {
        const sender = vi.fn<TranslateRequestSender>(async () => ({
            success: true,
            content: "你好"
        }))
        const deps = { microsoftRequestSender: sender }
        expect(
            await translateText(
                config,
                [{ role: "user", content: "Hello" }],
                "zh-CN",
                {},
                deps
            )
        ).toBe("你好")
        await translateBatch(
            config,
            [
                { role: "user", content: "One" },
                { role: "user", content: "Two" }
            ],
            "zh-CN",
            {},
            deps
        )
        expect(sender).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ type: "microsoft_translate" })
        )
        expect(sender.mock.calls[1]).toEqual([
            expect.objectContaining({
                config: expect.objectContaining({ text: "One\n\n%%\n\nTwo" })
            })
        ])
    })
    it("obtains credentials, maps Chinese, and caches credentials", async () => {
        const fetcher = vi
            .fn()
            .mockResolvedValueOnce(new Response(page))
            .mockImplementation(
                async () =>
                    new Response(
                        JSON.stringify([{ translations: [{ text: "你好" }] }])
                    )
            )
        vi.stubGlobal("fetch", fetcher)
        expect(await request()).toMatchObject({
            success: true,
            content: "你好"
        })
        expect(await request()).toMatchObject({
            success: true,
            content: "你好"
        })
        expect(fetcher).toHaveBeenCalledTimes(3)
        const form = fetcher.mock.calls[1][1].body as URLSearchParams
        expect(form.get("to")).toBe("zh-Hans")
        expect(form.get("fromLang")).toBe("auto-detect")
        expect(form.get("text")).toBe("Hello")
    })
    it("refreshes expired credentials once and reports rate limiting", async () => {
        const fetcher = vi
            .fn()
            .mockResolvedValueOnce(new Response(page))
            .mockResolvedValueOnce(new Response("", { status: 403 }))
            .mockResolvedValueOnce(new Response(page))
            .mockResolvedValueOnce(new Response("", { status: 429 }))
        vi.stubGlobal("fetch", fetcher)
        expect(await request()).toMatchObject({
            success: false,
            error: expect.stringContaining("429")
        })
        expect(fetcher).toHaveBeenCalledTimes(4)
    })
    it("rejects malformed translation responses", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(new Response(page))
                .mockResolvedValueOnce(new Response("{}"))
        )
        expect(await request()).toMatchObject({
            success: false,
            error: expect.stringContaining("无法识别")
        })
    })
    it("maps traditional Chinese and refreshes an expired cache", async () => {
        vi.useFakeTimers()
        const fetcher = vi.fn(
            async (url: string) =>
                new Response(
                    url.endsWith("/translator")
                        ? page
                        : '[{"translations":[{"text":"你好"}]}]'
                )
        )
        vi.stubGlobal("fetch", fetcher)
        await request(undefined, "zh-TW")
        const init = (fetcher.mock.calls as unknown[][])[1][1] as RequestInit
        expect((init.body as URLSearchParams).get("to")).toBe("zh-Hant")
        await vi.advanceTimersByTimeAsync(600_000)
        await request()
        expect(fetcher).toHaveBeenCalledTimes(4)
    })
    it.each([
        ["no", "nb"],
        ["sr", "sr-Cyrl"]
    ])(
        "maps %s to Microsoft's supported language code",
        async (language, expected) => {
            const fetcher = vi
                .fn()
                .mockResolvedValueOnce(new Response(page))
                .mockResolvedValueOnce(
                    new Response('[{"translations":[{"text":"translated"}]}]')
                )
            vi.stubGlobal("fetch", fetcher)
            expect(await request(undefined, language)).toMatchObject({
                success: true
            })
            expect(
                (fetcher.mock.calls[1][1].body as URLSearchParams).get("to")
            ).toBe(expected)
        }
    )
    it("bounds retries for authentication errors inside HTTP 200", async () => {
        const fetcher = vi.fn(
            async (url: string) =>
                new Response(
                    url.endsWith("/translator") ? page : '{"statusCode":401}'
                )
        )
        vi.stubGlobal("fetch", fetcher)
        expect(await request()).toMatchObject({
            success: false,
            error: expect.stringContaining("401")
        })
        expect(fetcher).toHaveBeenCalledTimes(4)
    })
    it("reports a changed or blocked authentication page clearly", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("<html>Unavailable</html>"))
        )
        expect(await request()).toMatchObject({
            success: false,
            error: expect.stringContaining("鉴权响应无法识别")
        })
    })
    it.each(["timeout", "cancel"])(
        "supports %s while obtaining credentials",
        async mode => {
            vi.useFakeTimers()
            const fetcher = vi.fn(
                (_url: string, init: RequestInit) =>
                    new Promise<Response>((_resolve, reject) => {
                        init.signal!.addEventListener(
                            "abort",
                            () =>
                                reject(
                                    new DOMException("Aborted", "AbortError")
                                ),
                            { once: true }
                        )
                    })
            )
            vi.stubGlobal("fetch", fetcher)
            const pending = request(50)
            if (mode === "timeout") await vi.advanceTimersByTimeAsync(50)
            else
                await handleTranslateRequest({
                    type: RequestType.ABORT,
                    config: null
                })
            expect(await pending).toMatchObject({
                success: false,
                error:
                    mode === "timeout"
                        ? "微软翻译请求超时"
                        : "微软翻译请求已取消"
            })
            expect(vi.getTimerCount()).toBe(0)
        }
    )
})
