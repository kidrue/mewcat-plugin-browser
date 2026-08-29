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
    if (root) {
        await act(async () => root?.unmount())
        root = undefined
    }
})

describe("selection concept explanation panel", () => {
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
        const explainButton = Array.from(
            document.querySelectorAll("button")
        ).find(button => button.textContent?.includes("解释概念"))
        expect(explainButton).toBeDefined()

        await act(async () => {
            explainButton?.dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            )
        })
        await flushEffects()

        expect(document.body.textContent).toContain("类别：历史事件")
        expect(document.body.textContent).toContain("AI 生成，未联网核验")
        expect(onFinished).toHaveBeenCalledTimes(3)
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
})
