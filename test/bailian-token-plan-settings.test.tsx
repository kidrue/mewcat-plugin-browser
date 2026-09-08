// @vitest-environment jsdom

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
    BailianOfficialEndpointFields,
    canExplicitlyConfigureVision
} from "../src/options/BailianOfficialEndpointFields"
import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"

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
})
