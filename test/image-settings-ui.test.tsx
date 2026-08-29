import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"
import type { ExtensionConfig } from "../src/types/config"

const mocks = vi.hoisted(() => ({
    config: null as ExtensionConfig | null,
    updateConfig: vi.fn(),
    updateAiModelConfig: vi.fn(),
    translateImage: vi.fn()
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
    return {
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
        ...overrides
    }
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
})

afterEach(async () => {
    if (root) {
        await act(async () => root?.unmount())
        root = undefined
    }
    vi.restoreAllMocks()
})

describe("image translation settings", () => {
    it("filters visual models and persists the image selection independently", async () => {
        const vision = createModel("vision")
        mocks.config = createConfig({
            aiModelList: [
                vision,
                createModel("text-only", {
                    type: AiModel_Platform_Enum.DEEPSEEK,
                    modelName: "deepseek-chat",
                    vision: false
                }),
                createModel("disabled-vision", { enabled: false }),
                createModel("missing-key", { apiKey: " " })
            ]
        })
        mocks.updateConfig.mockImplementation(updates => {
            mocks.config = { ...mocks.config!, ...updates }
        })
        const { Image } = await import("../src/options/Image")
        root = await render(<Image />)

        const selector = rowByLabel("视觉模型").querySelector("select")
        expect(selector).toBeInstanceOf(HTMLSelectElement)
        expect(selector!.labels?.[0]?.textContent).toBe("视觉模型")
        expect(
            Array.from(selector!.querySelectorAll("option")).map(option =>
                option.getAttribute("value")
            )
        ).toEqual(["", "vision"])

        await act(async () => {
            Object.getOwnPropertyDescriptor(
                window.HTMLSelectElement.prototype,
                "value"
            )?.set?.call(selector, "vision")
            selector!.dispatchEvent(
                new window.Event("change", { bubbles: true })
            )
        })

        expect(mocks.updateConfig).toHaveBeenCalledWith({
            imageTranslationModelId: "vision"
        })
        expect(mocks.updateConfig).not.toHaveBeenCalledWith(
            expect.objectContaining({ currentModel: expect.anything() })
        )

        await act(async () => root?.render(<Image />))

        expect(
            rowByLabel("视觉模型").querySelector<HTMLSelectElement>("select")
                ?.value
        ).toBe("vision")
        expect(mocks.config.imageTranslationModelId).toBe("vision")
        expect(mocks.config.currentModel).toBe("text-model")
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
            "请选择视觉模型后再启用图片翻译或运行能力测试"
        )
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

        await click(document.querySelector("button")!)
        mocks.config = {
            ...mocks.config,
            imageTranslationModelId: "vision-b"
        }
        await act(async () => root?.render(<Image />))
        expect(document.body.textContent).not.toContain("视觉能力测试成功")

        await click(document.querySelector("button")!)
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

        await click(document.querySelector("button")!)
        mocks.config = {
            ...mocks.config,
            imageTranslationModelId: "vision-b"
        }
        await act(async () => root?.render(<Image />))
        await click(document.querySelector("button")!)
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
            await click(document.querySelector("button")!)

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

        await click(document.querySelector("button")!)

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

        await click(document.querySelector("button")!)

        expect(document.querySelector('[role="alert"]')?.textContent).toBe(
            "视觉能力测试失败：图片中未识别到可翻译文字"
        )
    })

    it("keeps the generated capability image runtime-only", () => {
        const source = readFileSync(
            new URL("../src/options/Image.tsx", import.meta.url),
            "utf8"
        )
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
            "local:extension-config",
            expect.objectContaining({
                imageTranslationModelId: "vision",
                currentModel: "text-model"
            })
        )
        expect(storedConfig.imageTranslationModelId).toBe("vision")
        expect(storedConfig.currentModel).toBe("text-model")
    })
})
