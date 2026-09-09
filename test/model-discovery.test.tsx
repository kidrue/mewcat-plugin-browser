// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import ApiKeyInput from "../src/components/ApiKeyInput"
import { useDrag } from "../src/hooks/useDrag"
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
    it("docks the translation handle after dragging without moving on unrelated mouse releases", async () => {
        function DragProbe() {
            const drag = useDrag()
            return (
                <div
                    ref={drag.ref}
                    data-x={drag.position.x}
                    data-y={drag.position.y}
                >
                    <button data-mewcat-drag-handle>drag</button>
                    <button>settings</button>
                </div>
            )
        }
        const host = document.createElement("div")
        document.body.append(host)
        root = createRoot(host)
        await act(async () => root?.render(<DragProbe />))
        const container = host.firstElementChild as HTMLElement
        const handle = host.querySelector("button")!
        const initialX = window.innerWidth - 54
        expect(Number(container.dataset.x)).toBe(initialX)
        await act(async () => {
            document.dispatchEvent(new MouseEvent("mouseup"))
        })
        expect(Number(container.dataset.x)).toBe(initialX)
        await act(async () => {
            handle.dispatchEvent(
                new MouseEvent("mousedown", {
                    bubbles: true,
                    clientX: initialX,
                    clientY: 200
                })
            )
        })
        await act(async () => {
            document.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 10, clientY: 200 })
            )
        })
        await act(async () => {
            document.dispatchEvent(new MouseEvent("mouseup"))
        })
        expect(Number(container.dataset.x)).toBe(0)
    })
    it("clears API errors when switching services and ignores an old pending result", async () => {
        const host = document.createElement("div")
        document.body.append(host)
        root = createRoot(host)
        const failed = vi.fn(async () => false)
        const renderInput = (service: string, onTest = failed) =>
            root?.render(
                <ApiKeyInput
                    key={service}
                    label="API Key"
                    value="same-key"
                    onChange={() => undefined}
                    onTest={onTest}
                />
            )
        await act(async () => renderInput("first"))
        await act(async () =>
            host.querySelector<HTMLButtonElement>("button")!.click()
        )
        expect(host.textContent).toContain("API Key 验证失败")
        await act(async () => renderInput("second"))
        expect(host.textContent).not.toContain("API Key 验证失败")
        let resolve!: (result: boolean) => void
        const pending = vi.fn(
            () =>
                new Promise<boolean>(done => {
                    resolve = done
                })
        )
        await act(async () => renderInput("second", pending))
        await act(async () =>
            host.querySelector<HTMLButtonElement>("button")!.click()
        )
        await act(async () => renderInput("third"))
        await act(async () => resolve(false))
        expect(host.textContent).not.toContain("API Key 验证失败")
        expect(host.textContent).not.toContain("正在测试")
    })
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
