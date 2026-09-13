import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ExtensionConfig } from "../src/types/config"

const mocks = vi.hoisted(() => ({
    config: {
        isSelectedTranslate: true,
        targetLanguage: "zh-CN",
        detectedLanguage: "auto",
        aiRole: "DEFAULT",
        aiModelList: [],
        selectionTriggerMode: "direct",
        autoTranslateDelay: 700
    } as ExtensionConfig,
    translateText: vi.fn(),
    explainConcept: vi.fn()
}))

vi.mock("@/state/config", () => ({
    useConfig: () => mocks.config
}))

vi.mock("@/translation/translationService", () => ({
    translateText: mocks.translateText,
    explainConcept: mocks.explainConcept,
    streamConceptExplanation: mocks.explainConcept,
    getConceptExplanationErrorMessage: (error: unknown) =>
        error instanceof Error &&
        error.message === "配置生成式 AI 模型后可使用概念解释"
            ? error.message
            : "概念解释失败，请稍后重试"
}))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

const flushEffects = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(resolvePromise => {
        resolve = resolvePromise
    })
    return { promise, resolve }
}

let root: Root | undefined

async function renderExplanation(explanation: string, onFinished?: () => void) {
    mocks.explainConcept.mockResolvedValueOnce(explanation)
    const { TranslateTextPanel } = await import(
        "../src/components/TranslateTextPanel/index.tsx"
    )
    const host = document.querySelector<HTMLDivElement>("#host")!
    root = createRoot(host)
    await act(async () => {
        root?.render(
            <TranslateTextPanel
                data="Treaty of Versailles"
                pageTitle="Causes of World War II"
                context="The treaty reshaped Europe after World War I."
                onFinished={onFinished}
            />
        )
    })
    await flushEffects()
    const button = host.querySelector<HTMLButtonElement>("button")!
    await act(async () => button.click())
    await flushEffects()
    return { host, button }
}

beforeEach(() => {
    document.body.innerHTML = "<div id=host></div>"
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    mocks.translateText.mockReset().mockResolvedValue("凡尔赛条约")
    mocks.explainConcept
        .mockReset()
        .mockImplementation(
            async (
                _config: ExtensionConfig,
                input: { text: string; pageTitle?: string; context?: string },
                targetLanguage: string
            ) => {
                if (
                    input.text !== "Treaty of Versailles" ||
                    input.pageTitle !== "Causes of World War II" ||
                    input.context !==
                        "The treaty reshaped Europe after World War I." ||
                    targetLanguage !== "zh-CN"
                ) {
                    throw new Error("解释请求缺少选区语境")
                }
                return "类别：历史事件\n简释：第一次世界大战后的和平条约。"
            }
        )
})

afterEach(async () => {
    vi.useRealTimers()
    if (root) {
        await act(async () => root?.unmount())
        root = undefined
    }
})

describe("selection concept explanation panel", () => {
    it("isolates replaced selections and cancels an unmounted request", async () => {
        const first = deferred<string>()
        const second = deferred<string>()
        const streams: Array<{
            signal: AbortSignal
            onDelta: (text: string) => void
        }> = []
        mocks.explainConcept
            .mockImplementationOnce((_config, _input, _language, options) => {
                streams.push(options)
                return first.promise
            })
            .mockImplementationOnce((_config, _input, _language, options) => {
                streams.push(options)
                return second.promise
            })
        const { TranslateTextPanel } = await import(
            "../src/components/TranslateTextPanel/index.tsx"
        )
        const host = document.querySelector<HTMLDivElement>("#host")!
        root = createRoot(host)
        await act(async () =>
            root?.render(<TranslateTextPanel data="first selection" />)
        )
        await flushEffects()
        await act(async () =>
            host.querySelector<HTMLButtonElement>("button")!.click()
        )
        await act(async () => streams[0].onDelta("## 旧解释"))
        await act(async () =>
            root?.render(<TranslateTextPanel data="second selection" />)
        )
        expect(streams[0].signal.aborted).toBe(true)
        expect(host.textContent).not.toContain("旧解释")
        await act(async () =>
            host.querySelector<HTMLButtonElement>("button")!.click()
        )
        await act(async () => {
            streams[1].onDelta("## 新解释")
            streams[0].onDelta("迟到片段")
            first.resolve("迟到结果")
            await first.promise
        })
        expect(host.querySelector("h2")?.textContent).toBe("新解释")
        expect(host.textContent).not.toContain("迟到")
        expect(host.querySelector<HTMLButtonElement>("button")!.disabled).toBe(
            true
        )
        await act(async () => root?.unmount())
        root = undefined
        expect(streams[1].signal.aborted).toBe(true)
        await act(async () => {
            streams[1].onDelta("迟到片段")
            second.resolve("迟到结果")
            await second.promise
        })
        expect(host.textContent).toBe("")
    })

    it("coalesces chunk layout updates and repositions after completion", async () => {
        const pending = deferred<string>()
        const onFinished = vi.fn()
        let onDelta: (text: string) => void = () => {}
        mocks.explainConcept.mockImplementationOnce(
            (_config, _input, _language, options) => {
                onDelta = options.onDelta
                return pending.promise
            }
        )
        const { TranslateTextPanel } = await import(
            "../src/components/TranslateTextPanel/index.tsx"
        )
        const host = document.querySelector<HTMLDivElement>("#host")!
        root = createRoot(host)
        await act(async () =>
            root?.render(
                <TranslateTextPanel data="gravity" onFinished={onFinished} />
            )
        )
        await flushEffects()
        vi.useFakeTimers()
        await act(async () =>
            host.querySelector<HTMLButtonElement>("button")!.click()
        )
        onFinished.mockClear()
        for (const value of ["## 简释", "\n\n", "引", "力"]) {
            await act(async () => onDelta(value))
        }
        expect(host.querySelector("h2")?.textContent).toBe("简释")
        expect(onFinished).not.toHaveBeenCalled()
        await act(async () => vi.advanceTimersByTimeAsync(32))
        expect(onFinished).toHaveBeenCalledTimes(1)
        await act(async () => {
            pending.resolve("## 简释\n\n引力")
            await pending.promise
        })
        expect(onFinished).toHaveBeenCalledTimes(2)
        expect(host.querySelector<HTMLButtonElement>("button")!.disabled).toBe(
            false
        )
    })

    it("shows Markdown chunks before completion and aborts a hidden panel", async () => {
        const pending = deferred<string>()
        let stream:
            | { signal: AbortSignal; onDelta: (text: string) => void }
            | undefined
        mocks.explainConcept.mockImplementationOnce(
            (_config, _input, _language, options) => {
                stream = options
                return pending.promise
            }
        )
        const { TranslateTextPanel } = await import(
            "../src/components/TranslateTextPanel/index.tsx"
        )
        const host = document.querySelector<HTMLDivElement>("#host")!
        root = createRoot(host)
        await act(async () =>
            root?.render(<TranslateTextPanel data="Treaty of Versailles" />)
        )
        await flushEffects()
        const button = host.querySelector<HTMLButtonElement>("button")!
        await act(async () => button.click())
        expect(stream).toBeDefined()
        await act(async () => stream!.onDelta("## 类别\n\n**历史"))
        expect(host.querySelector("h2")?.textContent).toBe("类别")
        expect(button.disabled).toBe(true)
        await act(async () => stream!.onDelta("事件**"))
        expect(host.querySelector("strong")?.textContent).toBe("历史事件")
        await act(async () =>
            root?.render(
                <TranslateTextPanel
                    data="Treaty of Versailles"
                    active={false}
                />
            )
        )
        expect(stream!.signal.aborted).toBe(true)
        await act(async () => {
            stream!.onDelta("迟到片段")
            pending.resolve("迟到结果")
            await pending.promise
        })
        expect(host.textContent).not.toContain("迟到")
    })

    it("keeps partial text on failure and replaces it when retrying", async () => {
        mocks.explainConcept.mockImplementationOnce(
            async (_config, _input, _language, options) => {
                options.onDelta("## 已生成的部分\n\n内容")
                throw new Error("private provider error")
            }
        )
        const { TranslateTextPanel } = await import(
            "../src/components/TranslateTextPanel/index.tsx"
        )
        const host = document.querySelector<HTMLDivElement>("#host")!
        root = createRoot(host)
        await act(async () =>
            root?.render(<TranslateTextPanel data="Treaty of Versailles" />)
        )
        await flushEffects()
        const button = host.querySelector<HTMLButtonElement>("button")!
        await act(async () => button.click())
        expect(host.querySelector("h2")?.textContent).toBe("已生成的部分")
        expect(host.textContent).toContain("概念解释失败，请稍后重试")
        expect(host.textContent).not.toContain("private provider error")
        mocks.explainConcept.mockResolvedValueOnce("## 新解释")
        await act(async () => button.click())
        expect(host.querySelector("h2")?.textContent).toBe("新解释")
        expect(host.textContent).not.toContain("已生成的部分")
    })

    it("keeps translation visible and explains the selected concept on demand", async () => {
        const onFinished = vi.fn()
        const { TranslateTextPanel } = await import(
            "../src/components/TranslateTextPanel/index.tsx"
        )
        const host = document.querySelector<HTMLDivElement>("#host")
        expect(host).not.toBeNull()
        root = createRoot(host!)

        await act(async () => {
            root?.render(
                <TranslateTextPanel
                    data="Treaty of Versailles"
                    pageTitle="Causes of World War II"
                    context="The treaty reshaped Europe after World War I."
                    onFinished={onFinished}
                />
            )
        })
        await flushEffects()

        expect(document.body.textContent).toContain("凡尔赛条约")
        expect(host!.querySelectorAll(".mewcat-translation-mark")).toHaveLength(
            1
        )
        const explainButton = Array.from(
            document.querySelectorAll("button")
        ).find(button => button.textContent?.includes("解释概念"))
        expect(explainButton).toBeDefined()

        onFinished.mockClear()
        await act(async () => {
            explainButton?.dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            )
        })
        await flushEffects()

        expect(document.body.textContent).toContain("类别：历史事件")
        expect(document.querySelector("p")?.textContent).toBe(
            "类别：历史事件\n简释：第一次世界大战后的和平条约。"
        )
        expect(document.body.textContent).toContain("AI 生成，未联网核验")
        expect(onFinished).toHaveBeenCalled()
    })

    it("keeps translation visible when concept explanation is unavailable", async () => {
        const onFinished = vi.fn()
        mocks.explainConcept.mockRejectedValueOnce(
            new Error("配置生成式 AI 模型后可使用概念解释")
        )
        const { TranslateTextPanel } = await import(
            "../src/components/TranslateTextPanel/index.tsx"
        )
        const host = document.querySelector<HTMLDivElement>("#host")
        expect(host).not.toBeNull()
        root = createRoot(host!)

        await act(async () => {
            root?.render(
                <TranslateTextPanel
                    data="Ada Lovelace"
                    onFinished={onFinished}
                />
            )
        })
        await flushEffects()

        const explainButton = Array.from(
            document.querySelectorAll("button")
        ).find(button => button.textContent?.includes("解释概念"))
        await act(async () => {
            explainButton?.dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            )
        })
        await flushEffects()

        expect(document.body.textContent).toContain("凡尔赛条约")
        expect(document.body.textContent).toContain(
            "配置生成式 AI 模型后可使用概念解释"
        )
        expect(onFinished.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it("does not expose raw provider errors in the page", async () => {
        mocks.explainConcept.mockRejectedValueOnce(
            new Error("https://private-proxy.example/internal failed")
        )
        const { TranslateTextPanel } = await import(
            "../src/components/TranslateTextPanel/index.tsx"
        )
        const host = document.querySelector<HTMLDivElement>("#host")
        expect(host).not.toBeNull()
        root = createRoot(host!)

        await act(async () => {
            root?.render(<TranslateTextPanel data="Ada Lovelace" />)
        })
        await flushEffects()

        const explainButton = Array.from(
            document.querySelectorAll("button")
        ).find(button => button.textContent?.includes("解释概念"))
        await act(async () => {
            explainButton?.dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            )
        })
        await flushEffects()

        expect(document.body.textContent).toContain("概念解释失败，请稍后重试")
        expect(document.body.textContent).not.toContain("private-proxy")
    })

    it("repositions the panel while an explanation request changes layout", async () => {
        const onFinished = vi.fn()
        const explanation = deferred<string>()
        mocks.explainConcept.mockReturnValueOnce(explanation.promise)
        const { TranslateTextPanel } = await import(
            "../src/components/TranslateTextPanel/index.tsx"
        )
        const host = document.querySelector<HTMLDivElement>("#host")
        expect(host).not.toBeNull()
        root = createRoot(host!)

        await act(async () => {
            root?.render(
                <TranslateTextPanel
                    data="Treaty of Versailles"
                    onFinished={onFinished}
                />
            )
        })
        await flushEffects()

        expect(mocks.explainConcept).not.toHaveBeenCalled()
        const explainButton = Array.from(
            document.querySelectorAll("button")
        ).find(button => button.textContent?.includes("解释概念"))
        expect(explainButton).toBeDefined()

        await act(async () => {
            explainButton?.dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            )
        })

        expect(explainButton?.textContent).toContain("解释中")
        expect(explainButton?.disabled).toBe(true)
        expect(onFinished).toHaveBeenCalledTimes(2)

        await act(async () => {
            explanation.resolve("类别：历史事件")
            await explanation.promise
        })

        expect(explainButton?.textContent).toContain("重新解释")
        expect(explainButton?.disabled).toBe(false)
        expect(onFinished).toHaveBeenCalledTimes(3)
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

        expect(host.textContent).toContain("**凡尔赛条约**")
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

    it("renders the replacement Markdown and repositions after explaining again", async () => {
        const onFinished = vi.fn()
        const { host, button } = await renderExplanation(
            "## 初次解释",
            onFinished
        )
        expect(host.querySelector("h2")?.textContent).toBe("初次解释")

        const explanation = deferred<string>()
        mocks.explainConcept.mockReturnValueOnce(explanation.promise)
        onFinished.mockClear()
        await act(async () => button.click())
        expect(button.disabled).toBe(true)
        expect(button.textContent).toContain("解释中")
        expect(onFinished).toHaveBeenCalledTimes(1)

        await act(async () => {
            explanation.resolve("## 更新解释\n\n**补充语境**")
            await explanation.promise
        })
        await flushEffects()

        expect(host.querySelector("h2")?.textContent).toBe("更新解释")
        expect(host.querySelector("strong")?.textContent).toBe("补充语境")
        expect(host.textContent).not.toContain("初次解释")
        expect(host.textContent).toContain("凡尔赛条约")
        expect(button.disabled).toBe(false)
        expect(button.textContent).toContain("重新解释")
        expect(onFinished).toHaveBeenCalledTimes(2)
    })
})
