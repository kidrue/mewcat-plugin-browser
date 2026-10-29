// @vitest-environment jsdom
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TranslateTextPanel } from "../src/components/TranslateTextPanel"
import type { ExtensionConfig } from "../src/types/config"

const mocks = vi.hoisted(() => ({
    config: {} as ExtensionConfig,
    translateText: vi.fn(),
    explainConcept: vi.fn()
}))
vi.mock("@/state/config", () => ({ useConfig: () => mocks.config }))
vi.mock("@/translation/translationService", () => ({
    isConfiguredGenerativeModel: () => true,
    translateText: mocks.translateText,
    streamConceptExplanation: mocks.explainConcept
}))
const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act
const flushEffects = () =>
    act(async () => {
        await Promise.resolve()
    })
function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(done => {
        resolve = done
    })
    return { promise, resolve }
}
let root: Root | undefined
const host = () => document.querySelector<HTMLDivElement>("#host")!
async function render(
    props: React.ComponentProps<typeof TranslateTextPanel> = {}
) {
    root ??= createRoot(host())
    await act(async () =>
        root!.render(<TranslateTextPanel data="gravity" {...props} />)
    )
    await flushEffects()
    return host()
}
async function renderExplanation(explanation: string, onFinished?: () => void) {
    mocks.explainConcept.mockResolvedValueOnce(`[EXPLAIN]\n${explanation}`)
    return { host: await render({ onFinished }) }
}
beforeEach(() => {
    document.body.innerHTML = "<div id=host></div>"
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    mocks.config = {
        targetLanguage: "zh-CN",
        currentModel: "google-translate",
        aiRole: "DEFAULT",
        aiModelList: [{ id: "configured-model" }]
    } as ExtensionConfig
    mocks.translateText.mockReset().mockResolvedValue("凡尔赛条约")
    mocks.explainConcept
        .mockReset()
        .mockResolvedValue("[EXPLAIN]\n## 简释\n\n物体之间的吸引作用。")
})
afterEach(async () => {
    if (root) await act(async () => root!.unmount())
    root = undefined
    vi.useRealTimers()
})

describe("automatic selection explanation", () => {
    it("explains terms automatically in one request with context and no translation or explanation button", async () => {
        const onResultChange = vi.fn()
        await render({
            data: "gravity",
            pageTitle: "Physics",
            context: "mass and gravity",
            onResultChange
        })
        expect(mocks.explainConcept).toHaveBeenCalledTimes(1)
        expect(mocks.explainConcept).toHaveBeenCalledWith(
            mocks.config,
            {
                text: "gravity",
                pageTitle: "Physics",
                context: "mass and gravity",
                detectTerms: true
            },
            "zh-CN",
            expect.any(Object)
        )
        expect(mocks.translateText).not.toHaveBeenCalled()
        expect(host().querySelector("h2")?.textContent).toBe("简释")
        expect(host().querySelector("button")).toBeNull()
        expect(host().textContent).not.toContain("[EXPLAIN]")
        expect(onResultChange).toHaveBeenLastCalledWith(
            expect.objectContaining({
                mode: "explain",
                loading: false,
                value: "## 简释\n\n物体之间的吸引作用。"
            })
        )
    })
    it("waits for analysis before translating ordinary text with the selected service", async () => {
        const pending = deferred<string>()
        mocks.explainConcept.mockReturnValueOnce(pending.promise)
        await render({ data: "hello", onResultChange: vi.fn() })
        expect(mocks.translateText).not.toHaveBeenCalled()
        await act(async () => {
            pending.resolve("[TRANSLATE]")
            await pending.promise
        })
        expect(mocks.translateText).toHaveBeenCalledWith(
            mocks.config,
            [{ role: "user", content: "hello" }],
            "zh-CN"
        )
        expect(host().textContent).toContain("凡尔赛条约")
        expect(
            host().querySelectorAll(".mewcat-translation-mark")
        ).toHaveLength(1)
    })
    it("translates immediately without an AI model and gives a configuration hint", async () => {
        mocks.config = { ...mocks.config, aiModelList: [] }
        await render()
        expect(mocks.explainConcept).not.toHaveBeenCalled()
        expect(host().textContent).toContain("凡尔赛条约")
        expect(host().textContent).toContain("配置 AI 模型后可自动解释术语")
    })
    it.each(["", "## unmarked", "[EXPLAIN]\n ", "[TRANSLATE]\ninvalid body"])(
        "falls back once for malformed analysis %j",
        async response => {
            mocks.explainConcept.mockResolvedValueOnce(response)
            await render()
            expect(mocks.translateText).toHaveBeenCalledTimes(1)
            expect(host().textContent).toContain(
                "术语解释暂不可用，已使用普通翻译"
            )
            expect(host().textContent).not.toContain(response || "[EXPLAIN]")
        }
    )
    it("discards partial explanation on stream failure and safely falls back once", async () => {
        mocks.explainConcept.mockImplementationOnce(
            async (_c, _i, _l, options) => {
                options.onDelta("[EXPLAIN]\n## 不完整解释")
                throw new Error("https://private-proxy.example/internal")
            }
        )
        await render()
        expect(mocks.translateText).toHaveBeenCalledTimes(1)
        expect(host().textContent).toContain("凡尔赛条约")
        expect(host().textContent).not.toContain("不完整解释")
        expect(host().textContent).not.toContain("private-proxy")
    })
    it("retries only the failed translation without repeating the AI request", async () => {
        mocks.explainConcept.mockResolvedValueOnce("[TRANSLATE]")
        mocks.translateText.mockRejectedValueOnce(new Error("private failure"))
        await render()
        expect(host().textContent).not.toContain("private failure")
        await act(async () =>
            host().querySelector<HTMLButtonElement>("button")!.click()
        )
        expect(mocks.translateText).toHaveBeenCalledTimes(2)
        expect(mocks.explainConcept).toHaveBeenCalledTimes(1)
        expect(host().textContent).toContain("凡尔赛条约")
    })
    it("buffers split route markers and throttles streaming layout updates", async () => {
        const pending = deferred<string>()
        let delta!: (text: string) => void
        mocks.explainConcept.mockImplementationOnce((_c, _i, _l, options) => {
            delta = options.onDelta
            return pending.promise
        })
        const onFinished = vi.fn()
        await render({ onFinished })
        vi.useFakeTimers()
        onFinished.mockClear()
        for (const chunk of [
            "[EX",
            "PLAIN]",
            "\n## 简释",
            "\n\n",
            "引",
            "力"
        ]) {
            await act(async () => delta(chunk))
        }
        expect(host().querySelector("h2")?.textContent).toBe("简释")
        expect(host().textContent).not.toContain("[EX")
        expect(onFinished).not.toHaveBeenCalled()
        await act(async () => vi.advanceTimersByTimeAsync(32))
        expect(onFinished).toHaveBeenCalledTimes(1)
        await act(async () => {
            pending.resolve("[EXPLAIN]\n## 简释\n\n引力")
            await pending.promise
        })
        expect(onFinished).toHaveBeenCalledTimes(2)
    })
    it.each(["text", "context", "model", "language"])(
        "cancels stale analysis when %s changes",
        async change => {
            const pending = deferred<string>()
            let stream!: {
                signal: AbortSignal
                onDelta: (text: string) => void
            }
            mocks.explainConcept.mockImplementationOnce(
                (_c, _i, _l, options) => {
                    stream = options
                    return pending.promise
                }
            )
            await render({ context: "old" })
            await act(async () => stream.onDelta("[EXPLAIN]\n## 旧解释"))
            if (change === "model")
                mocks.config = { ...mocks.config, currentModel: "new-model" }
            if (change === "language")
                mocks.config = { ...mocks.config, targetLanguage: "en" }
            await render({
                data: change === "text" ? "new text" : "gravity",
                context: change === "context" ? "new" : "old"
            })
            expect(stream.signal.aborted).toBe(true)
            await act(async () => {
                stream.onDelta("迟到片段")
                pending.resolve("[TRANSLATE]")
                await pending.promise
            })
            expect(host().textContent).not.toContain("旧解释")
            expect(host().textContent).not.toContain("迟到")
            expect(mocks.translateText).not.toHaveBeenCalled()
            expect(mocks.explainConcept).toHaveBeenCalledTimes(2)
        }
    )
    it.each(["hide", "unmount"])(
        "aborts analysis on %s without triggering fallback",
        async action => {
            const pending = deferred<string>()
            let signal!: AbortSignal
            mocks.explainConcept.mockImplementationOnce(
                (_c, _i, _l, options) => {
                    signal = options.signal
                    return pending.promise
                }
            )
            await render()
            if (action === "hide") await render({ active: false })
            else {
                await act(async () => root!.unmount())
                root = undefined
            }
            expect(signal.aborted).toBe(true)
            await act(async () => {
                pending.resolve("[TRANSLATE]")
                await pending.promise
            })
            expect(mocks.translateText).not.toHaveBeenCalled()
        }
    )
    it("ignores an old ordinary translation that finishes after a new selection", async () => {
        const pending = deferred<string>()
        mocks.explainConcept.mockResolvedValueOnce("[TRANSLATE]")
        mocks.translateText.mockReturnValueOnce(pending.promise)
        await render({ data: "hello" })
        await render({ data: "gravity" })
        await act(async () => {
            pending.resolve("旧译文")
            await pending.promise
        })
        expect(host().textContent).not.toContain("旧译文")
        expect(host().textContent).toContain("物体之间")
    })
    it("renders ordinary translation as plain text", async () => {
        mocks.explainConcept.mockResolvedValueOnce("[TRANSLATE]")
        mocks.translateText.mockResolvedValueOnce("**hello**")
        await render()
        expect(host().textContent).toContain("**hello**")
        expect(host().querySelector("strong")).toBeNull()
    })
    it("renders basic Markdown only for concept explanations", async () => {
        mocks.translateText.mockResolvedValueOnce("**凡尔赛条约**")
        const { host } = await renderExplanation(
            [
                "# 类别",
                "",
                "**历史事件**，又称*和平条约*。",
                "",
                "- 背景",
                "- 语境",
                "",
                "1. 起因",
                "2. 影响",
                "",
                "> 需要结合上下文理解。",
                "",
                "行内代码：`treaty`。",
                "",
                "```text",
                "  first line",
                "    second line",
                "```"
            ].join("\n")
        )

        expect(host.textContent).not.toContain("**凡尔赛条约**")
        expect(host.querySelector("h1")?.textContent).toBe("类别")
        expect(host.querySelector("strong")?.textContent).toBe("历史事件")
        expect(host.querySelector("em")?.textContent).toBe("和平条约")
        expect(
            Array.from(host.querySelectorAll("ul > li"), li => li.textContent)
        ).toEqual(["背景", "语境"])
        expect(
            Array.from(host.querySelectorAll("ol > li"), li => li.textContent)
        ).toEqual(["起因", "影响"])
        expect(host.querySelector("blockquote p")?.textContent).toBe(
            "需要结合上下文理解。"
        )
        expect(host.querySelector("p > code")?.textContent).toBe("treaty")
        expect(host.querySelector("pre > code")?.textContent).toBe(
            "  first line\n    second line\n"
        )
        expect(host.textContent).toContain("AI 生成，未联网核验")
    })

    it("opens safe explanation links in an isolated new tab", async () => {
        const { host } = await renderExplanation(
            '[参考资料](https://example.com/history "历史资料")'
        )
        const link = host.querySelector("a")

        expect(link?.textContent).toBe("参考资料")
        expect(link?.getAttribute("href")).toBe("https://example.com/history")
        expect(link?.getAttribute("title")).toBe("历史资料")
        expect(link?.getAttribute("target")).toBe("_blank")
        expect(link?.getAttribute("rel")).toBe("noopener noreferrer")
    })

    it.each(["javascript:alert%281%29", "data:text/html;base64,PHNjcmlwdD4="])(
        "does not turn an unsafe URL into a navigation: %s",
        async url => {
            const { host } = await renderExplanation(`[危险链接](${url})`)

            expect(host.textContent).toContain("危险链接")
            expect(host.querySelector("a[href]")).toBeNull()
            expect(host.textContent).not.toContain(url)
        }
    )

    it("skips raw HTML while still rendering surrounding Markdown", async () => {
        const { host } = await renderExplanation(
            [
                "**可读解释**",
                "",
                '<script>alert("unsafe")</script>',
                "",
                '<iframe src="https://example.com/embed"></iframe>',
                "",
                '<img src="https://example.com/tracker.png" onerror="alert(1)">',
                "",
                "普通文本<span>保留文字</span>。"
            ].join("\n")
        )

        expect(host.querySelector("strong")?.textContent).toBe("可读解释")
        expect(host.querySelector("script, iframe, img, [onerror]")).toBeNull()
        expect(host.textContent).not.toContain("<script>")
        expect(host.textContent).not.toContain("unsafe")
        expect(host.textContent).toContain("普通文本保留文字。")
    })

    it("shows image alt text without loading remote images", async () => {
        const { host } = await renderExplanation(
            "背景：![历史示意图](https://example.com/tracker.png)"
        )

        expect(host.querySelector("p")?.textContent).toBe("背景：历史示意图")
        expect(host.querySelector("img")).toBeNull()
        expect(host.innerHTML).not.toContain("https://example.com/tracker.png")
    })
})
