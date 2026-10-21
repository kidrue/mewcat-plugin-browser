// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { PageActionExecutor } from "../src/reading/pageActions"
import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"
import type { ExtensionConfig } from "../src/types/config"

const mocks = vi.hoisted(() => ({
    config: null as ExtensionConfig | null,
    updateConfig: vi.fn()
}))

vi.mock("jotai", async importOriginal => ({
    ...(await importOriginal<typeof import("jotai")>()),
    useAtom: () => [mocks.config],
    useSetAtom: () => mocks.updateConfig
}))

vi.mock("@/state", () => ({
    configAtom: Symbol("configAtom"),
    updateConfigAtom: Symbol("updateConfigAtom"),
    getTranslationServiceOptions: (models: BaseModel[]) =>
        models.map(model => ({ value: model.id, label: model.name }))
}))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

const usableModel: BaseModel = {
    id: "summary-model",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    name: "Summary model",
    params: {
        apiKey: "configured-key",
        isOfficial: true,
        modelName: "gpt-5"
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
        aiModelList: [usableModel],
        selectionTriggerMode: "direct",
        autoTranslateDelay: 700,
        currentModel: usableModel.id,
        enableContext: true,
        enablePageSummary: false,
        alwaysTranslateUrls: [],
        ...overrides
    }
}

let root: Root | undefined

beforeEach(() => {
    document.body.innerHTML = "<div id=host></div>"
    Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: true,
        chrome: {
            runtime: {
                getURL: vi.fn((path: string) => path),
                sendMessage: vi.fn()
            },
            tabs: {
                create: vi.fn().mockResolvedValue({}),
                query: vi.fn().mockResolvedValue([])
            }
        }
    })
    mocks.config = createConfig()
    mocks.updateConfig.mockReset()
})

afterEach(async () => {
    if (root) {
        await act(async () => root?.unmount())
        root = undefined
    }
})

async function renderSettingsPanel(executePageAction?: PageActionExecutor) {
    const { default: SettingsPanel } = await import(
        "../src/components/SettingsPanel"
    )
    root = createRoot(document.querySelector<HTMLDivElement>("#host")!)
    await act(async () =>
        root?.render(
            <SettingsPanel
                variant="embedded"
                currentTabUrl={new URL("https://example.com/article")}
                executePageAction={executePageAction}
            />
        )
    )
}

describe("quick settings page summary setting", () => {
    it("opens the independent feedback page from the popup", async () => {
        await renderSettingsPanel()
        const feedback = document.querySelector<HTMLButtonElement>(
            'button[aria-label="意见反馈"]'
        )
        expect(feedback).not.toBeNull()
        await act(async () => feedback?.click())
        expect(chrome.tabs.create).toHaveBeenCalledWith({
            url: "feedback.html"
        })
    })

    it("offers the same feedback page from About and reuses an open draft tab", async () => {
        const { About } = await import("../src/options/About")
        const update = vi.fn().mockResolvedValue({})
        const focus = vi.fn().mockResolvedValue({})
        vi.mocked(chrome.tabs.query).mockResolvedValue([
            { id: 5, windowId: 2, url: "feedback.html" } as chrome.tabs.Tab
        ])
        Object.assign(chrome.tabs, { update })
        Object.assign(chrome, { windows: { update: focus } })
        root = createRoot(document.querySelector<HTMLDivElement>("#host")!)
        await act(async () => root?.render(<About />))
        const feedback = [...document.querySelectorAll("button")].find(button =>
            button.textContent?.includes("意见反馈")
        )
        expect(feedback).toBeDefined()
        await act(async () => feedback?.click())
        expect(update).toHaveBeenCalledWith(5, { active: true })
        expect(focus).toHaveBeenCalledWith(2, { focused: true })
        expect(chrome.tabs.create).not.toHaveBeenCalled()
    })

    it("shows the active page's detected language instead of the saved global language", async () => {
        mocks.config = createConfig({ detectedLanguage: "zh-CN" })
        await renderSettingsPanel(async () => ({
            status: "idle",
            translated: 0,
            failed: 0,
            sourceLanguage: "en"
        }))
        const source = document.querySelector<HTMLSelectElement>(
            'select[aria-label="网页语言"]'
        )!
        expect(source.value).toBe("en")
        expect(source.selectedOptions[0].textContent).toBe("英语")
        expect(mocks.updateConfig).not.toHaveBeenCalled()
    })

    it("keeps the original language row interactive and applies its override only to the current page", async () => {
        const execute = vi
            .fn<PageActionExecutor>()
            .mockImplementation(async request => ({
                status: "idle",
                translated: 0,
                failed: 0,
                sourceLanguage: request.sourceLanguage ?? "auto"
            }))
        await renderSettingsPanel(execute)
        const source = document.querySelector<HTMLSelectElement>(
            'select[aria-label="网页语言"]'
        )
        expect(source).not.toBeNull()
        expect(source?.disabled).toBe(false)
        await act(async () => {
            source!.value = "ja"
            source!.dispatchEvent(new Event("change", { bubbles: true }))
        })
        expect(execute).toHaveBeenLastCalledWith({
            type: "MEWCAT_PAGE_ACTION",
            action: "source",
            sourceLanguage: "ja"
        })
        expect(mocks.updateConfig).not.toHaveBeenCalled()
        expect(
            document.querySelector('input[aria-label="总是翻译此网站"]')
        ).not.toBeNull()
    })
    it("uses the saved summary state instead of context and writes its own field", async () => {
        await renderSettingsPanel()

        expect(document.body.textContent).toContain("自动总结页面")
        expect(document.body.textContent).toContain(
            "页面内容将发送到已配置的生成式 AI 服务"
        )
        const toggle = document.querySelector<HTMLInputElement>(
            'input[role="switch"][aria-label="自动总结页面"]'
        )
        expect(toggle).not.toBeNull()
        expect(toggle?.checked).toBe(false)

        await act(async () => toggle?.click())

        expect(mocks.updateConfig).toHaveBeenCalledWith({
            enablePageSummary: true
        })
    })

    it("keeps the saved toggle available while explaining a missing generative model", async () => {
        mocks.config = createConfig({
            aiModelList: [
                {
                    ...usableModel,
                    params: { ...usableModel.params, modelName: "   " }
                }
            ],
            currentModel: "google-translate",
            enablePageSummary: true
        })

        await renderSettingsPanel()

        const toggle = document.querySelector<HTMLInputElement>(
            'input[role="switch"][aria-label="自动总结页面"]'
        )
        expect(toggle?.checked).toBe(false)
        expect(toggle?.disabled).toBe(true)
        expect(document.body.textContent).toContain(
            "请先配置可用的生成式 AI 模型"
        )
    })

    it("opens advanced settings through the runtime bridge in a content script", async () => {
        const sendMessage = vi.fn()
        Object.assign(globalThis, {
            chrome: {
                runtime: {
                    getURL: vi.fn((path: string) => path),
                    sendMessage
                },
                tabs: {}
            }
        })

        await renderSettingsPanel()

        const settingsButton = Array.from(
            document.querySelectorAll("button")
        ).find(button => button.textContent?.trim() === "高级设置")
        expect(settingsButton).not.toBeNull()

        await act(async () => settingsButton?.click())

        expect(sendMessage).toHaveBeenCalledWith(
            { type: "OPEN_OPTIONS" },
            expect.any(Function)
        )
    })
})
