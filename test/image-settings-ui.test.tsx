import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { Simulate } from "react-dom/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"
import type { ExtensionConfig } from "../src/types/config"

const mocks = vi.hoisted(() => ({
    config: null as ExtensionConfig | null,
    updateConfig: vi.fn(),
    updateAiModelConfig: vi.fn(),
    translateImage: vi.fn(),
    discovery: {
        models: [],
        isLoading: false,
        errorMessage: "",
        manualEntry: false,
        refresh: vi.fn()
    }
}))

const atoms = vi.hoisted(() => ({
    config: Symbol("configAtom"),
    updateConfig: Symbol("updateConfigAtom"),
    updateAiModelConfig: Symbol("updateAiModelConfigAtom")
}))

vi.mock("jotai", () => ({
    useAtom: () => [mocks.config],
    useSetAtom: (atom: symbol) =>
        atom === atoms.updateAiModelConfig
            ? mocks.updateAiModelConfig
            : mocks.updateConfig
}))

vi.mock("@/state", () => ({
    configAtom: atoms.config,
    updateConfigAtom: atoms.updateConfig,
    updateAiModelConfigAtom: atoms.updateAiModelConfig,
    getTranslationServiceOptions: (models: BaseModel[]) =>
        models.map(model => ({ value: model.id, label: model.name })),
    resolveTranslationServiceId: ({ currentModel }: ExtensionConfig) =>
        currentModel || "google-translate"
}))

vi.mock("../src/state/index.ts", () => ({
    configAtom: atoms.config,
    updateConfigAtom: atoms.updateConfig,
    updateAiModelConfigAtom: atoms.updateAiModelConfig,
    getTranslationServiceOptions: (models: BaseModel[]) =>
        models.map(model => ({ value: model.id, label: model.name })),
    resolveTranslationServiceId: ({ currentModel }: ExtensionConfig) =>
        currentModel || "google-translate"
}))

vi.mock("@/state/config", () => ({
    configAtom: atoms.config,
    updateConfigAtom: atoms.updateConfig,
    updateAiModelConfigAtom: atoms.updateAiModelConfig,
    useConfig: () => mocks.config
}))

vi.mock("../src/state/config.ts", () => ({
    configAtom: atoms.config,
    updateConfigAtom: atoms.updateConfig,
    updateAiModelConfigAtom: atoms.updateAiModelConfig,
    useConfig: () => mocks.config
}))

vi.mock("@/services/imageTranslation", () => ({
    translateStructuredImageViaBackground: mocks.translateImage
}))

vi.mock("../src/services/imageTranslation.ts", () => ({
    translateStructuredImageViaBackground: mocks.translateImage
}))

vi.mock("@/hooks/useModelDiscovery", () => ({
    useModelDiscovery: () => mocks.discovery
}))

vi.mock("../src/hooks/useModelDiscovery.ts", () => ({
    useModelDiscovery: () => mocks.discovery
}))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

function createModel(
    id: string,
    options: {
        enabled?: boolean
        apiKey?: string
        isOfficial?: boolean
        vision?: boolean
        type?: AiModel_Platform_Enum
        modelName?: string
    } = {}
): BaseModel {
    return {
        id,
        type: options.type ?? AiModel_Platform_Enum.OPENAI,
        enabled: options.enabled ?? true,
        name: `${id} label`,
        capabilities: { vision: options.vision ?? true },
        params: {
            apiKey: options.apiKey ?? "configured-key",
            isOfficial: options.isOfficial ?? true,
            modelName: options.modelName ?? "gpt-5"
        }
    }
}

function createConfig(
    overrides: Partial<ExtensionConfig> = {}
): ExtensionConfig {
    const config = {
        isSelectedTranslate: true,
        targetLanguage: "zh-CN",
        detectedLanguage: "auto",
        aiRole: "DEFAULT" as ExtensionConfig["aiRole"],
        aiModelList: [],
        selectionTriggerMode: "direct",
        autoTranslateDelay: 700,
        currentModel: "text-model",
        enableImageTranslateButton: false,
        imageTranslationModelId: "",
        imageTranslationModelName: "",
        ...overrides
    }
    if (!config.imageTranslationModelName && config.imageTranslationModelId) {
        config.imageTranslationModelName =
            config.aiModelList.find(
                model => model.id === config.imageTranslationModelId
            )?.params.modelName ?? ""
    }
    return config
}

function setUpDom() {
    const dom = new JSDOM(
        "<!doctype html><html><body><div id=host></div></body></html>",
        { url: "https://example.test/options" }
    )
    const window = dom.window
    Object.defineProperties(globalThis, {
        window: { configurable: true, value: window },
        document: { configurable: true, value: window.document },
        navigator: { configurable: true, value: window.navigator },
        Element: { configurable: true, value: window.Element },
        HTMLElement: { configurable: true, value: window.HTMLElement },
        HTMLButtonElement: {
            configurable: true,
            value: window.HTMLButtonElement
        },
        HTMLCanvasElement: {
            configurable: true,
            value: window.HTMLCanvasElement
        },
        HTMLInputElement: {
            configurable: true,
            value: window.HTMLInputElement
        },
        HTMLSelectElement: {
            configurable: true,
            value: window.HTMLSelectElement
        },
        MouseEvent: { configurable: true, value: window.MouseEvent },
        Event: { configurable: true, value: window.Event },
        Node: { configurable: true, value: window.Node },
        SVGElement: { configurable: true, value: window.SVGElement },
        MutationObserver: {
            configurable: true,
            value: window.MutationObserver
        },
        getComputedStyle: {
            configurable: true,
            value: window.getComputedStyle.bind(window)
        },
        requestAnimationFrame: {
            configurable: true,
            value: (callback: FrameRequestCallback) => setTimeout(callback, 0)
        },
        cancelAnimationFrame: {
            configurable: true,
            value: (id: number) => clearTimeout(id)
        }
    })
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    vi.spyOn(window.HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        fillRect: vi.fn(),
        fillText: vi.fn()
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(window.HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
        "data:image/png;base64,generated-at-runtime"
    )
    return dom
}

async function render(element: React.ReactElement) {
    const host = document.querySelector<HTMLDivElement>("#host")
    if (!host) {
        throw new Error("missing test host")
    }
    const root = createRoot(host)
    await act(async () => root.render(element))
    return root
}

function rowByLabel(label: string): HTMLElement {
    const labelNode = Array.from(document.querySelectorAll("label")).find(
        element => element.textContent === label
    )
    const row = labelNode?.parentElement?.parentElement
    if (!(row instanceof HTMLElement)) {
        throw new Error(`missing row: ${label}`)
    }
    return row
}

async function click(element: Element) {
    await act(async () => {
        element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
    })
}

function capabilityTestButton(): HTMLButtonElement {
    const button = Array.from(document.querySelectorAll("button")).find(
        element => element.textContent === "测试视觉能力"
    )
    if (!(button instanceof HTMLButtonElement)) {
        throw new Error("missing capability test button")
    }
    return button
}

async function changeSelect(select: HTMLSelectElement, value: string) {
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            window.HTMLSelectElement.prototype,
            "value"
        )?.set?.call(select, value)
        select.dispatchEvent(new window.Event("change", { bubbles: true }))
    })
}

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

const successfulCapabilityResult = (modelId: string) => ({
    sourceWidth: 320,
    sourceHeight: 160,
    modelId,
    cacheHit: false,
    blocks: [
        {
            box: [0.1, 0.1, 0.8, 0.2] as [number, number, number, number],
            sourceText: "Image translation test",
            translatedText: "图片翻译测试"
        }
    ]
})

let root: Root | undefined

beforeEach(() => {
    setUpDom()
    mocks.updateConfig.mockReset()
    mocks.updateAiModelConfig.mockReset()
    mocks.translateImage.mockReset()
    mocks.discovery = {
        models: [],
        isLoading: false,
        errorMessage: "",
        manualEntry: false,
        refresh: vi.fn()
    }
})

afterEach(async () => {
    if (root) {
        await act(async () => root?.unmount())
        root = undefined
    }
    vi.restoreAllMocks()
})

describe("image translation settings", () => {
    it("discovers visual models for the selected service and persists only the image model name", async () => {
        mocks.config = createConfig({
            currentModel: "text-service",
            aiModelList: [
                createModel("bailian-service", {
                    type: AiModel_Platform_Enum.BAILIAN,
                    modelName: "qwen-plus"
                })
            ]
        })
        mocks.discovery.models = [
            {
                id: "qwen-vl-max",
                name: "Qwen VL Max",
                availability: "verified",
                vision: "supported"
            },
            {
                id: "qwen-plus",
                name: "Qwen Plus",
                availability: "verified",
                vision: "unsupported"
            }
        ]
        mocks.updateConfig.mockImplementation(updates => {
            mocks.config = { ...mocks.config!, ...updates }
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        const serviceSelector = rowByLabel("翻译服务").querySelector(
            "select"
        ) as HTMLSelectElement
        await changeSelect(serviceSelector, "bailian-service")
        expect(mocks.updateConfig).toHaveBeenLastCalledWith({
            imageTranslationModelId: "bailian-service",
            imageTranslationModelName: "",
            enableImageTranslateButton: false
        })

        await act(async () => root?.render(<Image />))
        const modelSelector = rowByLabel("视觉模型").querySelector(
            "select"
        ) as HTMLSelectElement
        expect(
            Array.from(modelSelector.options)
                .filter(option => option.value)
                .map(option => option.value)
        ).toEqual(["qwen-vl-max"])

        await changeSelect(modelSelector, "qwen-vl-max")
        expect(mocks.updateConfig).toHaveBeenLastCalledWith({
            imageTranslationModelName: "qwen-vl-max"
        })
        expect(mocks.config.currentModel).toBe("text-service")
        expect(mocks.config.aiModelList[0].params.modelName).toBe("qwen-plus")
    })

    it("keeps separate service configurations on the same platform isolated", async () => {
        mocks.config = createConfig({
            aiModelList: [
                createModel("bailian-first", {
                    type: AiModel_Platform_Enum.BAILIAN,
                    modelName: "qwen-plus"
                }),
                createModel("bailian-second", {
                    type: AiModel_Platform_Enum.BAILIAN,
                    modelName: "qwen-turbo"
                })
            ]
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        const serviceSelector = rowByLabel("翻译服务").querySelector(
            "select"
        ) as HTMLSelectElement
        expect(
            Array.from(serviceSelector.options).map(option => option.value)
        ).toEqual(["", "bailian-first", "bailian-second"])

        await changeSelect(serviceSelector, "bailian-second")
        expect(mocks.updateConfig).toHaveBeenLastCalledWith({
            imageTranslationModelId: "bailian-second",
            imageTranslationModelName: "",
            enableImageTranslateButton: false
        })
    })

    it("allows a custom service to enter a visual model name manually", async () => {
        mocks.config = createConfig({
            aiModelList: [
                createModel("custom-service", {
                    isOfficial: false,
                    modelName: "text-model"
                })
            ],
            imageTranslationModelId: "custom-service"
        })
        mocks.discovery.manualEntry = true
        mocks.discovery.errorMessage = "当前自定义接口不支持自动获取模型列表"
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        const manualInput = rowByLabel("视觉模型").querySelector("input")
        expect(manualInput).toBeInstanceOf(HTMLInputElement)
        await act(async () => {
            Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value"
            )?.set?.call(manualInput, "private-vl")
            Simulate.change(manualInput!)
        })
        expect(mocks.updateConfig).toHaveBeenLastCalledWith({
            imageTranslationModelName: "private-vl"
        })
        expect(document.body.textContent).toContain(
            "当前自定义接口不支持自动获取模型列表"
        )
    })

    it("keeps the stored visual model available when discovery does not return it", async () => {
        mocks.config = createConfig({
            aiModelList: [createModel("service")],
            imageTranslationModelId: "service",
            imageTranslationModelName: "legacy-vl"
        })
        mocks.discovery.models = [
            {
                id: "current-vl",
                name: "Current VL",
                availability: "verified",
                vision: "supported"
            }
        ]
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        const modelSelector = rowByLabel("视觉模型").querySelector(
            "select"
        ) as HTMLSelectElement
        expect(modelSelector.value).toBe("legacy-vl")
        expect(
            Array.from(modelSelector.options).map(option => option.value)
        ).toEqual(["legacy-vl", "current-vl"])
        expect(document.body.textContent).toContain("当前模型未返回")
    })

    it("lists configured services without changing the text translation selection", async () => {
        mocks.config = createConfig({
            currentModel: "google-translate",
            aiModelList: [
                createModel("openai-first"),
                createModel("openai-second"),
                createModel("gemini-vision", {
                    type: AiModel_Platform_Enum.GEMINI,
                    modelName: "gemini-2.5-flash"
                }),
                createModel("text-only", {
                    type: AiModel_Platform_Enum.DEEPSEEK,
                    modelName: "deepseek-chat",
                    vision: false
                }),
                createModel("disabled-vision", { enabled: false }),
                createModel("missing-key", { apiKey: " " })
            ],
            imageTranslationModelId: "openai-second"
        })
        mocks.updateConfig.mockImplementation(updates => {
            mocks.config = { ...mocks.config!, ...updates }
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        const serviceSelector = rowByLabel("翻译服务").querySelector("select")
        expect(serviceSelector).toBeInstanceOf(HTMLSelectElement)
        expect(serviceSelector!.labels?.[0]?.textContent).toBe("翻译服务")
        expect(serviceSelector!.value).toBe("openai-second")
        expect(
            Array.from(serviceSelector!.querySelectorAll("option")).map(
                option => option.getAttribute("value")
            )
        ).toEqual([
            "openai-first",
            "openai-second",
            "gemini-vision",
            "text-only"
        ])

        const modelSelector = rowByLabel("视觉模型").querySelector("select")
        expect(modelSelector).toBeInstanceOf(HTMLSelectElement)
        expect(modelSelector!.value).toBe("gpt-5")
        expect(
            Array.from(modelSelector!.querySelectorAll("option")).map(option =>
                option.getAttribute("value")
            )
        ).toEqual(["gpt-5"])

        await changeSelect(serviceSelector!, "openai-first")

        expect(mocks.updateConfig).toHaveBeenCalledWith({
            imageTranslationModelId: "openai-first",
            imageTranslationModelName: "",
            enableImageTranslateButton: false
        })
        expect(mocks.updateConfig).not.toHaveBeenCalledWith(
            expect.objectContaining({ currentModel: expect.anything() })
        )

        await act(async () => root?.render(<Image />))

        expect(
            rowByLabel("翻译服务").querySelector<HTMLSelectElement>("select")
                ?.value
        ).toBe("openai-first")
        expect(mocks.config.imageTranslationModelId).toBe("openai-first")
        expect(mocks.config.currentModel).toBe("google-translate")
    })

    it("clears the image model when the selected service changes", async () => {
        mocks.config = createConfig({
            currentModel: "google-translate",
            aiModelList: [
                createModel("openai-vision"),
                createModel("gemini-first", {
                    type: AiModel_Platform_Enum.GEMINI,
                    modelName: "gemini-2.5-flash"
                }),
                createModel("gemini-second", {
                    type: AiModel_Platform_Enum.GEMINI,
                    modelName: "gemini-2.5-pro"
                })
            ],
            imageTranslationModelId: "openai-vision"
        })
        mocks.updateConfig.mockImplementation(updates => {
            mocks.config = { ...mocks.config!, ...updates }
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        const serviceSelector = rowByLabel("翻译服务").querySelector(
            "select"
        ) as HTMLSelectElement
        await changeSelect(serviceSelector, "gemini-second")

        expect(mocks.updateConfig).toHaveBeenCalledWith({
            imageTranslationModelId: "gemini-second",
            imageTranslationModelName: "",
            enableImageTranslateButton: false
        })
        expect(mocks.updateConfig).not.toHaveBeenCalledWith(
            expect.objectContaining({ currentModel: expect.anything() })
        )

        await act(async () => root?.render(<Image />))

        expect(
            rowByLabel("翻译服务").querySelector<HTMLSelectElement>("select")
                ?.value
        ).toBe("gemini-second")
        expect(mocks.config.currentModel).toBe("google-translate")
    })

    it("shows empty guidance and guards image controls until a model is selected", async () => {
        mocks.config = createConfig({
            aiModelList: [createModel("vision")],
            enableImageTranslateButton: true,
            imageTranslationModelId: ""
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        expect(document.body.textContent).toContain(
            "请先在‘模型’设置中添加并启用 AI 平台并填写 API Key"
        )
        expect(
            rowByLabel("翻译服务").querySelector<HTMLSelectElement>("select")
                ?.disabled
        ).toBe(false)
        expect(
            rowByLabel("视觉模型").querySelector<HTMLSelectElement>("select")
                ?.disabled
        ).toBe(true)
        const shortcut = rowByLabel("图片上显示快捷翻译按钮").querySelector(
            '[role="switch"]'
        ) as HTMLInputElement
        expect(shortcut.labels?.[0]?.textContent).toBe("图片上显示快捷翻译按钮")
        expect(shortcut.disabled).toBe(true)
        expect(shortcut.checked).toBe(false)
        const testButton = Array.from(document.querySelectorAll("button")).find(
            button => button.textContent === "测试视觉能力"
        )
        expect(testButton).toBeDefined()
        expect(testButton!.disabled).toBe(true)
        expect(document.body.textContent).toContain("发送给所选模型服务商")
        expect(document.body.textContent).toContain("可能产生服务商费用")
    })

    it("disables service selection when no usable AI service is configured", async () => {
        mocks.config = createConfig({
            aiModelList: [
                createModel("missing-key", { apiKey: " " }),
                createModel("disabled-service", { enabled: false })
            ]
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        expect(
            rowByLabel("翻译服务").querySelector<HTMLSelectElement>("select")
                ?.disabled
        ).toBe(true)
        expect(
            rowByLabel("视觉模型").querySelector<HTMLSelectElement>("select")
                ?.disabled
        ).toBe(true)
        expect(document.body.textContent).toContain(
            "请先在‘模型’设置中添加并启用 AI 平台并填写 API Key"
        )
    })

    it("persists a disabled shortcut flag when the selected vision model becomes invalid", async () => {
        mocks.config = createConfig({
            aiModelList: [createModel("vision", { enabled: false })],
            enableImageTranslateButton: true,
            imageTranslationModelId: "vision"
        })
        mocks.updateConfig.mockImplementation(updates => {
            mocks.config = { ...mocks.config!, ...updates }
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        expect(mocks.updateConfig).toHaveBeenCalledWith({
            enableImageTranslateButton: false
        })

        await act(async () => root?.unmount())
        root = await render(<Image />)
        const shortcut = document.querySelector<HTMLInputElement>(
            '[role="switch"][aria-checked="false"]'
        )
        expect(shortcut?.checked).toBe(false)
        expect(mocks.config.enableImageTranslateButton).toBe(false)
        expect(mocks.config.currentModel).toBe("text-model")
    })

    it("generates a runtime image and reports loading then success through the strict background route", async () => {
        let resolveTranslation: ((value: unknown) => void) | undefined
        mocks.translateImage.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveTranslation = resolve
                })
        )
        mocks.config = createConfig({
            aiModelList: [createModel("vision")],
            imageTranslationModelId: "vision"
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)
        const testButton = Array.from(document.querySelectorAll("button")).find(
            button => button.textContent === "测试视觉能力"
        )!

        await click(testButton)
        expect(testButton.textContent).toBe("测试中…")
        expect(testButton.disabled).toBe(true)
        expect(mocks.translateImage).toHaveBeenCalledWith({
            imageUrl: "data:image/png;base64,generated-at-runtime",
            targetLanguage: "zh-CN",
            modelId: "vision"
        })
        expect(mocks.translateImage.mock.calls[0][0]).not.toHaveProperty(
            "apiKey"
        )

        await act(async () => {
            resolveTranslation?.(successfulCapabilityResult("vision"))
            await Promise.resolve()
        })
        expect(document.body.textContent).toContain("视觉能力测试成功")
    })

    it("ignores an older model result and reports only the latest model test", async () => {
        const oldRequest = deferred<unknown>()
        const currentRequest = deferred<unknown>()
        mocks.translateImage
            .mockReturnValueOnce(oldRequest.promise)
            .mockReturnValueOnce(currentRequest.promise)
        mocks.config = createConfig({
            aiModelList: [createModel("vision-a"), createModel("vision-b")],
            imageTranslationModelId: "vision-a"
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        await click(capabilityTestButton())
        mocks.config = {
            ...mocks.config,
            imageTranslationModelId: "vision-b"
        }
        await act(async () => root?.render(<Image />))
        expect(document.body.textContent).not.toContain("视觉能力测试成功")

        await click(capabilityTestButton())
        await act(async () => {
            oldRequest.resolve(successfulCapabilityResult("vision-a"))
            await oldRequest.promise
        })
        expect(document.body.textContent).toContain("测试中…")
        expect(document.body.textContent).not.toContain("视觉能力测试成功")

        await act(async () => {
            currentRequest.resolve(successfulCapabilityResult("vision-b"))
            await currentRequest.promise
        })
        expect(document.body.textContent).toContain("视觉能力测试成功")
    })

    it("ignores an older model rejection after a new test starts", async () => {
        const oldRequest = deferred<unknown>()
        const currentRequest = deferred<unknown>()
        mocks.translateImage
            .mockReturnValueOnce(oldRequest.promise)
            .mockReturnValueOnce(currentRequest.promise)
        mocks.config = createConfig({
            aiModelList: [createModel("vision-a"), createModel("vision-b")],
            imageTranslationModelId: "vision-a"
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        await click(capabilityTestButton())
        mocks.config = {
            ...mocks.config,
            imageTranslationModelId: "vision-b"
        }
        await act(async () => root?.render(<Image />))
        await click(capabilityTestButton())
        await act(async () => {
            oldRequest.reject(new Error("vision-a failed late"))
            await oldRequest.promise.catch(() => undefined)
        })

        expect(document.body.textContent).toContain("测试中…")
        expect(document.body.textContent).not.toContain("failed late")
        currentRequest.resolve(successfulCapabilityResult("vision-b"))
        await currentRequest.promise
    })

    it.each(["resolve", "reject"] as const)(
        "does not commit capability state when a pending request %ss after unmount",
        async settlement => {
            const pending = deferred<unknown>()
            mocks.translateImage.mockReturnValue(pending.promise)
            mocks.config = createConfig({
                aiModelList: [createModel("vision")],
                imageTranslationModelId: "vision"
            })
            const { Image } = await import("../src/options/Image")
            root = await render(<Image />)
            await click(capabilityTestButton())

            await act(async () => root?.unmount())
            root = undefined
            if (settlement === "resolve") {
                pending.resolve(successfulCapabilityResult("vision"))
            } else {
                pending.reject(new Error("late capability failure"))
            }
            await pending.promise.catch(() => undefined)
            await act(async () => {})

            expect(document.querySelector('[role="status"]')).toBeNull()
            expect(document.querySelector('[role="alert"]')).toBeNull()
        }
    )

    it("treats a resolved result with no text blocks as a stable capability failure", async () => {
        mocks.translateImage.mockResolvedValue({
            ...successfulCapabilityResult("vision"),
            blocks: []
        })
        mocks.config = createConfig({
            aiModelList: [createModel("vision")],
            imageTranslationModelId: "vision"
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        await click(capabilityTestButton())

        expect(document.querySelector('[role="alert"]')?.textContent).toBe(
            "视觉能力测试失败：图片中未识别到可翻译文字"
        )
    })

    it("shows the stable NO_TEXT failure returned by the strict service", async () => {
        mocks.translateImage.mockRejectedValue(
            new Error("图片中未识别到可翻译文字")
        )
        mocks.config = createConfig({
            aiModelList: [createModel("vision")],
            imageTranslationModelId: "vision"
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        await click(capabilityTestButton())

        expect(document.querySelector('[role="alert"]')?.textContent).toBe(
            "视觉能力测试失败：图片中未识别到可翻译文字"
        )
    })

    it("keeps the generated capability image runtime-only", () => {
        const source = readFileSync("src/options/Image.tsx", "utf8")
        expect(source).not.toMatch(
            /(?:import|from)\s*[('"].*\.(?:png|jpe?g|webp|gif|svg)/i
        )
    })

    it("shows the strict background error without exposing provider credentials", async () => {
        mocks.translateImage.mockRejectedValue(new Error("视觉模型认证失败"))
        mocks.config = createConfig({
            aiModelList: [createModel("vision")],
            imageTranslationModelId: "vision"
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)
        const testButton = Array.from(document.querySelectorAll("button")).find(
            button => button.textContent === "测试视觉能力"
        )!

        await click(testButton)

        expect(document.body.textContent).toContain(
            "视觉能力测试失败：视觉模型认证失败"
        )
        expect(document.body.textContent).not.toContain("configured-key")
    })
})

describe("custom model visual capability", () => {
    it("shows the custom toggle and saves only capabilities.vision", async () => {
        mocks.config = createConfig({
            aiModelList: [
                createModel("custom-model", {
                    isOfficial: false,
                    modelName: "private-multimodal-model",
                    vision: false
                })
            ],
            currentModel: "custom-model"
        })
        const { TranslateServices } = await import(
            "../src/options/TranslateServices"
        )
        root = await render(<TranslateServices />)

        const capabilityRow = rowByLabel("支持图片输入")
        const toggle = capabilityRow.querySelector(
            '[role="switch"]'
        ) as HTMLInputElement
        expect(toggle.labels?.[0]?.textContent).toBe("支持图片输入")
        expect(toggle.checked).toBe(false)

        await click(toggle)

        expect(mocks.updateAiModelConfig).toHaveBeenCalledWith({
            id: "custom-model",
            capabilities: { vision: true }
        })
    })

    it("keeps official capability inference out of the custom override UI", async () => {
        mocks.config = createConfig({
            aiModelList: [createModel("official-model")],
            currentModel: "official-model"
        })
        const { TranslateServices } = await import(
            "../src/options/TranslateServices"
        )
        root = await render(<TranslateServices />)

        expect(document.body.textContent).not.toContain("支持图片输入")
    })
})

describe("config persistence contract", () => {
    it("writes the independent image model through the real updateConfigAtom and storage adapter", async () => {
        const initialConfig = createConfig({
            aiModelList: [createModel("text-model"), createModel("vision")],
            currentModel: "text-model"
        })
        let storedConfig = initialConfig
        const setItem = vi.fn(async (_key: string, value: ExtensionConfig) => {
            storedConfig = value
        })

        vi.doUnmock("jotai")
        vi.doUnmock("@/state/config")
        vi.doUnmock("../src/state/config.ts")
        vi.doMock("#imports", () => ({
            storage: {
                getItem: vi.fn(async () => storedConfig),
                setItem,
                removeItem: vi.fn(async () => undefined),
                watch: vi.fn(() => () => undefined)
            }
        }))
        vi.resetModules()

        const [{ createStore }, { configAtom, updateConfigAtom }] =
            await Promise.all([
                import("jotai/vanilla"),
                import("../src/state/config.ts")
            ])
        const store = createStore()
        await store.get(configAtom)

        await store.set(updateConfigAtom, {
            imageTranslationModelId: "vision"
        })

        expect(setItem).toHaveBeenCalledWith(
            "sync:extension-config",
            expect.objectContaining({
                imageTranslationModelId: "vision",
                currentModel: "text-model"
            })
        )
        expect(storedConfig.imageTranslationModelId).toBe("vision")
        expect(storedConfig.currentModel).toBe("text-model")
    })
})
