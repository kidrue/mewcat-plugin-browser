// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useModelDiscovery } from "../src/hooks/useModelDiscovery"
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

const createModel = (isOfficial = true): BaseModel => ({
    id: "configured-service",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    name: "Configured service",
    params: {
        apiKey: "secret",
        isOfficial,
        baseUrl: isOfficial ? "" : "https://example.test/v1",
        modelName: "text-model"
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

function DiscoveryProbe({ model }: { model: BaseModel }): React.ReactElement {
    const discovery = useModelDiscovery(model)

    return (
        <output data-manual-entry={String(discovery.manualEntry)}>
            {discovery.isLoading ? "loading" : "idle"}:{discovery.models.length}
            :{discovery.errorMessage}
        </output>
    )
}

describe("useModelDiscovery", () => {
    it("waits for the debounce then exposes discovered models", async () => {
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
        root = createRoot(host)

        await act(async () =>
            root?.render(<DiscoveryProbe model={createModel()} />)
        )
        expect(mocks.discoverModels).not.toHaveBeenCalled()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(400)
        })

        expect(mocks.discoverModels).toHaveBeenCalledWith(
            expect.objectContaining({ apiKey: "secret", isOfficial: true }),
            {},
            expect.any(AbortSignal)
        )
        expect(host.textContent).toContain("idle:1")
    })

    it("allows manual entry only for unsupported custom discovery", async () => {
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
            root?.render(<DiscoveryProbe model={createModel(false)} />)
        )
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400)
        })

        expect(host.querySelector("output")?.dataset.manualEntry).toBe("true")
        expect(host.textContent).toContain(
            "当前自定义接口不支持自动获取模型列表"
        )
    })
})
