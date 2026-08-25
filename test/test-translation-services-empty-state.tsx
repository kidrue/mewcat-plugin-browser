import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import React from "react"
import { createRoot } from "react-dom/client"

import { AI_TRANSLATION_SERVICES } from "../src/constants/translationServices"
import { AddModel } from "../src/components/AddModel"

const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act

const dom = new JSDOM("<!doctype html><html><body><div id=host></div></body></html>", {
    url: "https://example.com/options"
})

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
            <AddModel label="添加 AI 模型" onItemClick={() => undefined} />
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

function hasRole(element: HTMLElement, role: "button"): boolean {
    const explicitRole = element.getAttribute("role")
    if (explicitRole) {
        return explicitRole.split(/\s+/).includes(role)
    }

    return element instanceof HTMLButtonElement
}

function getByRole(role: "button", options: { name: string }) {
    const elements = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
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

assert.equal(
    getByRole("button", { name: "添加模型" }).textContent,
    "添加模型"
)
const customTrigger = getByRole("button", { name: "添加 AI 模型" })
assert.equal(customTrigger.textContent, "添加 AI 模型")

await act(async () => {
    customTrigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
})

for (const service of AI_TRANSLATION_SERVICES) {
    assert.ok(document.body.textContent?.includes(service.name), service.name)
}

await act(async () => {
    root.unmount()
})
dom.window.close()

console.log("translation-services-empty-state: PASS")
