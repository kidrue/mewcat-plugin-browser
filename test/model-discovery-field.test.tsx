// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
    buildModelSelectionOptions,
    getVisionCapabilityLabel,
    ModelDiscoveryField,
    toModelCapabilityPatch
} from "../src/components/ModelDiscoveryField"
import { ModelDiscoveryError } from "../src/model-management/discovery"
import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"

const mocks = vi.hoisted(() => ({ discoverModels: vi.fn() }))

vi.mock("../src/model-management/discovery", async importOriginal => ({
    ...(await importOriginal<
        typeof import("../src/model-management/discovery")
    >()),
    discoverModels: mocks.discoverModels
}))

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const createModel = (isOfficial: boolean): BaseModel => ({
    id: "configured-model",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    name: "Configured model",
    params: {
        apiKey: "secret",
        isOfficial,
        baseUrl: isOfficial ? "" : "https://example.test/v1",
        modelName: ""
    }
})

let root: Root | undefined

afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    root = undefined
    vi.useRealTimers()
    mocks.discoverModels.mockReset()
    document.body.replaceChildren()
})

describe("model discovery field", () => {
    it("preserves a configured model that the provider no longer returns", () => {
        expect(
            buildModelSelectionOptions(
                [
                    {
                        id: "gpt-5",
                        name: "GPT-5",
                        availability: "verified",
                        vision: "supported"
                    }
                ],
                "gpt-4-legacy"
            )
        ).toEqual([
            {
                value: "gpt-4-legacy",
                label: "gpt-4-legacy（当前模型未返回）"
            },
            { value: "gpt-5", label: "GPT-5 · 支持图片" }
        ])
    })

    it("does not duplicate the currently selected discovered model", () => {
        expect(
            buildModelSelectionOptions(
                [
                    {
                        id: "text-model",
                        name: "Text model",
                        availability: "catalog",
                        vision: "unsupported"
                    }
                ],
                "text-model"
            )
        ).toEqual([
            { value: "text-model", label: "Text model · 仅文本 · 目录" }
        ])
    })

    it("maps discovered vision metadata to persisted model capabilities", () => {
        expect(toModelCapabilityPatch("supported")).toEqual({ vision: true })
        expect(toModelCapabilityPatch("unsupported")).toEqual({
            vision: false
        })
        expect(toModelCapabilityPatch("unknown")).toBeUndefined()
        expect(getVisionCapabilityLabel("unknown")).toBe("图片能力未知")
    })

    it("loads models after an API key is configured and persists the selected capability", async () => {
        vi.useFakeTimers()
        mocks.discoverModels.mockResolvedValue([
            {
                id: "vision-model",
                name: "Vision model",
                availability: "verified",
                vision: "supported"
            }
        ])
        const host = document.createElement("div")
        document.body.append(host)
        const onChange = vi.fn()
        root = createRoot(host)
        await act(async () =>
            root?.render(
                <ModelDiscoveryField
                    model={createModel(true)}
                    onChange={onChange}
                />
            )
        )
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400)
        })

        const select = document.querySelector("select")!
        expect(mocks.discoverModels).toHaveBeenCalledWith(
            expect.objectContaining({ apiKey: "secret", isOfficial: true }),
            {},
            expect.any(AbortSignal)
        )
        expect(select.disabled).toBe(false)
        await act(async () => {
            select.value = "vision-model"
            select.dispatchEvent(new Event("change", { bubbles: true }))
        })
        expect(onChange).toHaveBeenCalledWith("vision-model", {
            vision: true
        })
    })

    it("backfills capability metadata for an existing selected model", async () => {
        vi.useFakeTimers()
        mocks.discoverModels.mockResolvedValue([
            {
                id: "vision-model",
                name: "Vision model",
                availability: "verified",
                vision: "supported"
            }
        ])
        const configuredModel = createModel(true)
        configuredModel.params.modelName = "vision-model"
        const host = document.createElement("div")
        document.body.append(host)
        const onChange = vi.fn()
        root = createRoot(host)
        await act(async () =>
            root?.render(
                <ModelDiscoveryField
                    model={configuredModel}
                    onChange={onChange}
                />
            )
        )
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400)
        })

        expect(onChange).toHaveBeenCalledWith("vision-model", {
            vision: true
        })
    })

    it("switches a custom endpoint to manual model entry when discovery is unsupported", async () => {
        vi.useFakeTimers()
        mocks.discoverModels.mockRejectedValue(
            new ModelDiscoveryError(
                "DISCOVERY_UNSUPPORTED",
                "当前自定义接口不支持自动获取模型列表"
            )
        )
        const host = document.createElement("div")
        document.body.append(host)
        root = createRoot(host)
        await act(async () =>
            root?.render(
                <ModelDiscoveryField
                    model={createModel(false)}
                    onChange={() => undefined}
                />
            )
        )
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400)
        })

        expect(
            document.querySelector(
                'input[placeholder="请输入自定义接口的模型名称"]'
            )
        ).not.toBeNull()
        expect(document.body.textContent).toContain(
            "该接口不支持自动获取模型列表，已切换为手动填写"
        )
    })
})
