import assert from "node:assert/strict"
import { createStore, Provider } from "jotai"
import { JSDOM } from "jsdom"
import React from "react"
import { createRoot } from "react-dom/client"

import { AddModel } from "../src/components/AddModel"
import { AIModelEmptyState } from "../src/components/AIModelEmptyState"
import { AI_TRANSLATION_SERVICES } from "../src/constants/translationServices"
import {
    hasConfiguredAiModels,
    TranslateServices
} from "../src/options/TranslateServices"
import { configAtom } from "../src/state/config"
import { defaultExtensionConfig } from "../src/state/constants"
import type { BaseModel } from "../src/types"

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

const dom = new JSDOM(
    "<!doctype html><html><body><div id=host></div></body></html>",
    {
        url: "https://example.com/options"
    }
)

Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    Element: { configurable: true, value: dom.window.Element },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    HTMLButtonElement: {
        configurable: true,
        value: dom.window.HTMLButtonElement
    },
    MouseEvent: { configurable: true, value: dom.window.MouseEvent },
    Event: { configurable: true, value: dom.window.Event },
    EventTarget: { configurable: true, value: dom.window.EventTarget },
    Node: { configurable: true, value: dom.window.Node },
    getComputedStyle: {
        configurable: true,
        value: dom.window.getComputedStyle.bind(dom.window)
    }
})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const host = document.querySelector<HTMLDivElement>("#host")
assert.ok(host)
const root = createRoot(host)

await act(async () => {
    root.render(
        <>
            <AddModel onItemClick={() => undefined} />
            <AIModelEmptyState onItemClick={() => undefined} />
        </>
    )
})

function isHiddenFromAccessibility(element: HTMLElement): boolean {
    if (
        element.hidden ||
        element.getAttribute("aria-hidden") === "true" ||
        element.style.display === "none" ||
        element.style.visibility === "hidden"
    ) {
        return true
    }

    const parent = element.parentElement
    return parent ? isHiddenFromAccessibility(parent) : false
}

function getTextAlternative(element: Element): string {
    return Array.from(element.childNodes)
        .map(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                return child.textContent ?? ""
            }

            if (child instanceof HTMLElement) {
                return isHiddenFromAccessibility(child)
                    ? ""
                    : getTextAlternative(child)
            }

            return ""
        })
        .join("")
}

function getAccessibleName(element: HTMLElement): string {
    const labelledBy = element.getAttribute("aria-labelledby")
    if (labelledBy) {
        return labelledBy
            .split(/\s+/)
            .map(id => document.getElementById(id)?.textContent ?? "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
    }

    const ariaLabel = element.getAttribute("aria-label")
    if (ariaLabel) {
        return ariaLabel.trim()
    }

    return getTextAlternative(element).replace(/\s+/g, " ").trim()
}

function hasRole(element: HTMLElement, role: "button" | "heading"): boolean {
    const explicitRole = element.getAttribute("role")
    if (explicitRole) {
        return explicitRole.split(/\s+/).includes(role)
    }

    return role === "button"
        ? element instanceof HTMLButtonElement
        : /^H[1-6]$/.test(element.tagName)
}

function getByRole(role: "button" | "heading", options: { name: string }) {
    const elements = Array.from(
        document.body.querySelectorAll<HTMLElement>("*")
    )
    const matching = elements.filter(
        element =>
            !isHiddenFromAccessibility(element) &&
            hasRole(element, role) &&
            getAccessibleName(element) === options.name
    )
    assert.equal(
        matching.length,
        1,
        `Expected one ${role} named ${options.name}`
    )
    return matching[0]
}

assert.equal(getByRole("button", { name: "添加模型" }).textContent, "添加模型")
const emptyStateTrigger = getByRole("button", { name: "添加 AI 模型" })
assert.equal(emptyStateTrigger.textContent, "添加 AI 模型")

await act(async () => {
    emptyStateTrigger.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true })
    )
})

for (const service of AI_TRANSLATION_SERVICES) {
    assert.ok(document.body.textContent?.includes(service.name), service.name)
}

assert.ok(getByRole("heading", { name: "添加你的第一个 AI 模型" }))
assert.match(document.body.textContent ?? "", /未添加时仍会使用 Google 翻译/)
assert.ok(getByRole("button", { name: "添加 AI 模型" }))
assert.equal(
    document.querySelectorAll('[aria-hidden="true"]').length,
    1,
    "the empty-state marker is hidden from assistive technology"
)
assert.equal(document.querySelectorAll("img").length, 0)

await act(async () => {
    root.unmount()
})

const model: BaseModel = {
    id: "first-model",
    type: AI_TRANSLATION_SERVICES[0].type,
    enabled: true,
    name: AI_TRANSLATION_SERVICES[0].name,
    params: {
        modelName: "test-model",
        isOfficial: true,
        apiKey: "test-key",
        baseUrl: ""
    }
}

assert.equal(hasConfiguredAiModels(undefined), false)
assert.equal(hasConfiguredAiModels([]), false)
assert.equal(hasConfiguredAiModels([model]), true)

const servicesStore = createStore()
const emptyConfig = { ...defaultExtensionConfig, aiModelList: [] }
servicesStore.set(configAtom, emptyConfig)

const servicesRoot = createRoot(host)
await act(async () => {
    servicesRoot.render(
        <Provider store={servicesStore}>
            <TranslateServices />
        </Provider>
    )
})

assert.ok(getByRole("button", { name: "添加 AI 模型" }))
assert.equal(document.body.textContent?.includes("模型测试"), false)

await act(async () => {
    servicesStore.set(configAtom, {
        ...emptyConfig,
        aiModelList: [model]
    })
})

assert.ok(document.body.textContent?.includes(model.name))
assert.ok(getByRole("heading", { name: "模型测试" }))

await act(async () => {
    servicesStore.set(configAtom, emptyConfig)
})

assert.ok(getByRole("button", { name: "添加 AI 模型" }))
assert.equal(document.body.textContent?.includes("模型测试"), false)

await act(async () => {
    servicesRoot.unmount()
})
dom.window.close()

console.log("translation-services-empty-state: PASS")
