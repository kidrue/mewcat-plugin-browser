// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
            runtime: { getURL: vi.fn((path: string) => path) },
            tabs: { create: vi.fn() }
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

async function renderSettingsPanel() {
    const { default: SettingsPanel } = await import(
        "../src/components/SettingsPanel"
    )
    root = createRoot(document.querySelector<HTMLDivElement>("#host")!)
    await act(async () => root?.render(<SettingsPanel variant="embedded" />))
}

describe("quick settings page summary setting", () => {
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
            aiModelList: [],
            currentModel: "google-translate",
            enablePageSummary: true
        })

        await renderSettingsPanel()

        const toggle = document.querySelector<HTMLInputElement>(
            'input[role="switch"][aria-label="自动总结页面"]'
        )
        expect(toggle?.checked).toBe(true)
        expect(toggle?.disabled).toBe(false)
        expect(document.body.textContent).toContain(
            "请先配置可用的生成式 AI 模型"
        )
    })
})
