// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
    BailianOfficialEndpointFields,
    canExplicitlyConfigureVision
} from "../src/options/BailianOfficialEndpointFields"
import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"

const servicesMocks = vi.hoisted(() => ({
    config: null as { aiModelList: BaseModel[]; currentModel?: string } | null,
    updateConfig: vi.fn(),
    updateAiModelConfig: vi.fn()
}))

const serviceAtoms = vi.hoisted(() => ({
    config: Symbol("configAtom"),
    updateConfig: Symbol("updateConfigAtom"),
    updateAiModelConfig: Symbol("updateAiModelConfigAtom")
}))

vi.mock("#imports", () => ({
    storage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        watch: vi.fn(() => () => undefined)
    }
}))

vi.mock("jotai", async importOriginal => ({
    ...(await importOriginal<typeof import("jotai")>()),
    useAtom: () => [servicesMocks.config],
    useSetAtom: () => servicesMocks.updateAiModelConfig
}))

vi.mock("@/state", () => ({
    configAtom: serviceAtoms.config,
    updateConfigAtom: serviceAtoms.updateConfig,
    updateAiModelConfigAtom: serviceAtoms.updateAiModelConfig,
    getTranslationServiceOptions: (models: BaseModel[]) =>
        models.map(model => ({ value: model.id, label: model.name })),
    resolveTranslationServiceId: (config: { currentModel?: string }) =>
        config.currentModel || "google-translate"
}))

vi.mock("../src/state/index.ts", () => ({
    configAtom: serviceAtoms.config,
    updateConfigAtom: serviceAtoms.updateConfig,
    updateAiModelConfigAtom: serviceAtoms.updateAiModelConfig,
    getTranslationServiceOptions: (models: BaseModel[]) =>
        models.map(model => ({ value: model.id, label: model.name })),
    resolveTranslationServiceId: (config: { currentModel?: string }) =>
        config.currentModel || "google-translate"
}))

vi.mock("../src/state/index", () => ({
    configAtom: serviceAtoms.config,
    updateConfigAtom: serviceAtoms.updateConfig,
    updateAiModelConfigAtom: serviceAtoms.updateAiModelConfig,
    getTranslationServiceOptions: (models: BaseModel[]) =>
        models.map(model => ({ value: model.id, label: model.name })),
    resolveTranslationServiceId: (config: { currentModel?: string }) =>
        config.currentModel || "google-translate"
}))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const createModel = (
    type: AiModel_Platform_Enum,
    isOfficial = true,
    officialEndpointId?: string
): BaseModel => ({
    id: "model-id",
    type,
    enabled: true,
    name: "Configured model",
    params: {
        apiKey: "secret",
        baseUrl: "",
        isOfficial,
        modelName: "qwen-plus",
        officialEndpointId
    }
})

let root: Root | undefined

afterEach(async () => {
    if (root) {
        await act(async () => root?.unmount())
    }
    root = undefined
    document.body.replaceChildren()
    servicesMocks.config = null
    servicesMocks.updateConfig.mockReset()
    servicesMocks.updateAiModelConfig.mockReset()
})

describe("BailianOfficialEndpointFields", () => {
    it("renders all official Bailian endpoint options", async () => {
        const host = document.createElement("div")
        document.body.append(host)
        root = createRoot(host)

        await act(async () =>
            root?.render(
                <BailianOfficialEndpointFields
                    model={createModel(AiModel_Platform_Enum.BAILIAN)}
                    onEndpointChange={() => undefined}
                />
            )
        )

        const select = document.querySelector<HTMLSelectElement>("select")
        expect(select).not.toBeNull()
        expect(Array.from(select!.options).map(option => option.value)).toEqual([
            "pay-as-you-go-cn",
            "token-plan-cn",
            "token-plan-intl"
        ])
    })

    it("emits the selected Token Plan endpoint and shows its usage note", async () => {
        const host = document.createElement("div")
        document.body.append(host)
        const onEndpointChange = vi.fn()
        const model = createModel(
            AiModel_Platform_Enum.BAILIAN,
            true,
            "token-plan-cn"
        )
        root = createRoot(host)

        await act(async () =>
            root?.render(
                <BailianOfficialEndpointFields
                    model={model}
                    onEndpointChange={onEndpointChange}
                />
            )
        )

        expect(document.querySelector('[role="note"]')?.textContent).toContain(
            "Token Plan"
        )
        expect(document.querySelector('[role="note"]')?.textContent).toContain(
            "自定义应用程序"
        )
        expect(document.querySelector('[role="note"]')?.textContent).toContain(
            "订阅被暂停或 API Key 被封禁"
        )
        expect(
            document.querySelector<HTMLAnchorElement>(
                'a[href="https://help.aliyun.com/zh/model-studio/more-tools"]'
            )
        ).not.toBeNull()

        const select = document.querySelector<HTMLSelectElement>("select")!
        await act(async () => {
            select.value = "token-plan-intl"
            select.dispatchEvent(new Event("change", { bubbles: true }))
        })
        expect(onEndpointChange).toHaveBeenCalledWith("token-plan-intl")
        expect(model.params).toMatchObject({
            apiKey: "secret",
            modelName: "qwen-plus"
        })
    })

    it("does not render for non-Bailian or custom models", async () => {
        const host = document.createElement("div")
        document.body.append(host)
        root = createRoot(host)

        await act(async () =>
            root?.render(
                <BailianOfficialEndpointFields
                    model={createModel(AiModel_Platform_Enum.OPENAI)}
                    onEndpointChange={() => undefined}
                />
            )
        )
        expect(host.textContent).toBe("")

        await act(async () =>
            root?.render(
                <BailianOfficialEndpointFields
                    model={createModel(AiModel_Platform_Enum.BAILIAN, false)}
                    onEndpointChange={() => undefined}
                />
            )
        )
        expect(host.textContent).toBe("")
    })

    it("allows an explicit vision declaration only for custom or Token Plan models", () => {
        expect(
            canExplicitlyConfigureVision(
                createModel(AiModel_Platform_Enum.BAILIAN)
            )
        ).toBe(false)
        expect(
            canExplicitlyConfigureVision(
                createModel(
                    AiModel_Platform_Enum.BAILIAN,
                    true,
                    "token-plan-cn"
                )
            )
        ).toBe(true)
        expect(
            canExplicitlyConfigureVision(
                createModel(AiModel_Platform_Enum.OPENAI, false)
            )
        ).toBe(true)
    })

    it("keeps an invalid official endpoint recoverable without treating it as Token Plan", async () => {
        const host = document.createElement("div")
        document.body.append(host)
        root = createRoot(host)

        await act(async () =>
            root?.render(
                <BailianOfficialEndpointFields
                    model={createModel(
                        AiModel_Platform_Enum.BAILIAN,
                        true,
                        "unknown-channel"
                    )}
                    onEndpointChange={() => undefined}
                />
            )
        )

        expect(document.querySelector('[role="alert"]')?.textContent).toContain(
            "当前官方通道配置无效"
        )
        expect(
            document.querySelector<HTMLSelectElement>("select")
        ).not.toBeNull()
        expect(
            canExplicitlyConfigureVision(
                createModel(
                    AiModel_Platform_Enum.BAILIAN,
                    true,
                    "unknown-channel"
                )
            )
        ).toBe(false)
    })

    it("updates the parent config when switching endpoint while preserving the Key and model name", async () => {
        const host = document.createElement("div")
        document.body.append(host)
        root = createRoot(host)
        const model = createModel(
            AiModel_Platform_Enum.BAILIAN,
            true,
            "pay-as-you-go-cn"
        )
        servicesMocks.config = {
            aiModelList: [model],
            currentModel: model.id
        }
        servicesMocks.updateAiModelConfig.mockImplementation(update => {
            servicesMocks.config = {
                ...servicesMocks.config!,
                aiModelList: servicesMocks.config!.aiModelList.map(item =>
                    item.id === update.id
                        ? {
                              ...item,
                              params: { ...item.params, ...update.params }
                          }
                        : item
                )
            }
        })
        const { TranslateServices } = await import(
            "../src/options/TranslateServices"
        )

        await act(async () =>
            root?.render(
                <TranslateServices />
            )
        )

        const requestAddress = document.querySelector<HTMLInputElement>(
            'input[placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1/"]'
        )
        expect(requestAddress?.value).toBe(
            "https://dashscope.aliyuncs.com/compatible-mode/v1/"
        )

        const select = document.querySelector<HTMLSelectElement>(
            `#bailian-official-endpoint-${model.id}`
        )!
        await act(async () => {
            select.value = "token-plan-intl"
            select.dispatchEvent(new Event("change", { bubbles: true }))
            root?.render(<TranslateServices />)
        })

        const updatedModel = servicesMocks.config.aiModelList[0]!
        expect(updatedModel.params).toMatchObject({
            officialEndpointId: "token-plan-intl",
            apiKey: "secret",
            modelName: "qwen-plus"
        })
        expect(
            document.querySelector<HTMLInputElement>(
                'input[placeholder="https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/"]'
            )?.value
        ).toBe(
            "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/"
        )
    })

    it("uses the custom URL when a custom model retains an invalid official endpoint ID", async () => {
        const host = document.createElement("div")
        document.body.append(host)
        root = createRoot(host)
        const model = createModel(
            AiModel_Platform_Enum.BAILIAN,
            false,
            "unknown-channel"
        )
        model.params.baseUrl = "https://proxy.example.test/v1"
        servicesMocks.config = {
            aiModelList: [model],
            currentModel: model.id
        }
        const { TranslateServices } = await import(
            "../src/options/TranslateServices"
        )

        await act(async () => root?.render(<TranslateServices />))

        expect(
            document.querySelector<HTMLInputElement>(
                'input[placeholder="请输入自定义请求地址（如代理或私有部署）"]'
            )?.value
        ).toBe("https://proxy.example.test/v1")
        expect(document.querySelector('[role="alert"]')).toBeNull()
    })
})
