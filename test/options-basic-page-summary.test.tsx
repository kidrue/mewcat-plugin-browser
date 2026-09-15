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
    updateConfigAtom: Symbol("updateConfigAtom")
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
        enableContext: false,
        enablePageSummary: true,
        ...overrides
    }
}

let root: Root | undefined

beforeEach(() => {
    document.body.innerHTML = "<div id=host></div>"
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    mocks.config = createConfig()
    mocks.updateConfig.mockReset()
})

afterEach(async () => {
    if (root) {
        await act(async () => root?.unmount())
        root = undefined
    }
})

async function renderBasic() {
    const { Basic } = await import("../src/options/Basic")
    root = createRoot(document.querySelector<HTMLDivElement>("#host")!)
    await act(async () => root?.render(<Basic />))
}

describe("options page summary setting", () => {
    it("offers opt-in reading-range translation independently of summary settings", async () => {
        await renderBasic()
        const toggle = document.querySelector<HTMLInputElement>('input[role="switch"][aria-label="按阅读范围翻译"]')
        expect(toggle).not.toBeNull()
        expect(toggle?.checked).toBe(false)
        await act(async () => toggle?.click())
        expect(mocks.updateConfig).toHaveBeenCalledWith({ enableViewportTranslation: true })
    })
    it("shows the saved summary state independently and writes its own field", async () => {
        await renderBasic()

        expect(document.body.textContent).toContain("页面总结")
        expect(document.body.textContent).toContain(
            "页面内容将发送到已配置的生成式 AI 服务"
        )
        const toggle = document.querySelector<HTMLInputElement>(
            'input[role="switch"][aria-label="自动总结页面"]'
        )
        expect(toggle).not.toBeNull()
        expect(toggle?.checked).toBe(true)

        await act(async () => toggle?.click())

        expect(mocks.updateConfig).toHaveBeenCalledWith({
            enablePageSummary: false
        })
    })

    it("keeps the saved toggle available while explaining a missing generative model", async () => {
        mocks.config = createConfig({
            aiModelList: [
                {
                    ...usableModel,
                    type: AiModel_Platform_Enum.DEEPL
                }
            ]
        })

        await renderBasic()

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
