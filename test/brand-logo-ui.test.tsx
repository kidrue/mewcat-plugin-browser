// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ExtensionConfig } from "../src/types/config"

const mocks = vi.hoisted(() => ({
    config: {
        isSelectedTranslate: true,
        targetLanguage: "zh-CN",
        detectedLanguage: "auto",
        currentModel: "google-translate",
        aiRole: "DEFAULT",
        aiModelList: [],
        selectionTriggerMode: "direct",
        autoTranslateDelay: 700,
        alwaysTranslateUrls: []
    } as ExtensionConfig,
    updateConfig: vi.fn()
}))

vi.mock("jotai", () => ({
    useAtom: () => [mocks.config],
    useSetAtom: () => mocks.updateConfig
}))

vi.mock("@/state", () => ({
    configAtom: Symbol("configAtom"),
    updateConfigAtom: Symbol("updateConfigAtom"),
    getTranslationServiceOptions: () => []
}))

vi.mock("@/state/config", () => ({
    useConfig: () => mocks.config
}))

vi.mock("@/translation/translationService", () => ({
    isConfiguredGenerativeModel: () => false,
    translateText: vi.fn()
}))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

let container: HTMLDivElement
let root: Root | undefined

beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: true,
        chrome: {
            runtime: {
                getURL: (path: string) => `chrome-extension://mewcat/${path}`
            },
            tabs: { create: vi.fn() }
        }
    })
})

afterEach(async () => {
    if (root) {
        await act(async () => root?.unmount())
        root = undefined
    }
    container.remove()
})

function expectGeneratedExtensionLogo() {
    const logo = container.querySelector<HTMLImageElement>(
        'img[src="chrome-extension://mewcat/icons/128.png"]'
    )

    expect(logo).not.toBeNull()
    expect(logo?.getAttribute("alt")).toBe("")
    expect(logo?.draggable).toBe(false)
}

describe("brand logo placement", () => {
    it("shows the generated extension icon in the options sidebar", async () => {
        const { default: OptionsSidebar } = await import(
            "../src/components/OptionsSidebar"
        )
        await act(async () =>
            root?.render(
                <OptionsSidebar
                    title="设置"
                    subtitle="译趣喵"
                    navigationItems={[
                        {
                            id: "basic",
                            label: "基础",
                            description: "基础设置"
                        }
                    ]}
                    activeTab="basic"
                    onTabChange={vi.fn()}
                />
            )
        )

        expectGeneratedExtensionLogo()
    })

    it("shows the generated extension icon in the settings panel header", async () => {
        const { default: SettingsPanel } = await import(
            "../src/components/SettingsPanel"
        )
        await act(async () => root?.render(<SettingsPanel />))

        expectGeneratedExtensionLogo()
    })

    it("shows the generated extension icon in the sidepanel header", async () => {
        const { default: SidePanel } = await import("../src/sidepanel")
        await act(async () => root?.render(<SidePanel />))

        expectGeneratedExtensionLogo()
    })
})
