// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest"

import {
    installParagraphShortcut,
    shortcutFromEvent
} from "../src/translation/paragraphShortcut"

let cleanup: (() => void) | undefined
afterEach(() => {
    cleanup?.()
    vi.restoreAllMocks()
    delete (document as Partial<Document>).elementFromPoint
    document.body.innerHTML = ""
})
it("triggers only over page content and removes listeners on cleanup", () => {
    document.body.innerHTML =
        '<p id="target">Hovered text</p><input id="editor" />'
    const target = document.querySelector("p")!
    Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: vi.fn(() => target)
    })
    const trigger = vi.fn()
    cleanup = installParagraphShortcut("Alt+KeyQ", trigger)
    target.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 20, clientY: 30 })
    )
    document.dispatchEvent(
        new KeyboardEvent("keydown", {
            bubbles: true,
            code: "KeyQ",
            altKey: true
        })
    )
    expect(trigger).toHaveBeenCalledWith(target)
    document.dispatchEvent(
        new KeyboardEvent("keydown", {
            code: "KeyQ",
            altKey: true,
            repeat: true
        })
    )
    document.dispatchEvent(
        new KeyboardEvent("keydown", {
            code: "KeyQ",
            altKey: true,
            isComposing: true
        })
    )
    document.querySelector("input")!.focus()
    document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyQ", altKey: true })
    )
    expect(trigger).toHaveBeenCalledTimes(1)
    cleanup()
    document.querySelector<HTMLInputElement>("input")!.blur()
    document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyQ", altKey: true })
    )
    expect(trigger).toHaveBeenCalledTimes(1)
})
it("records stable single keys and exact modifier combinations", () => {
    expect(
        shortcutFromEvent(
            new KeyboardEvent("keydown", { code: "KeyQ", altKey: true })
        )
    ).toBe("Alt+KeyQ")
    expect(
        shortcutFromEvent(new KeyboardEvent("keydown", { code: "F8" }))
    ).toBe("F8")
    expect(
        shortcutFromEvent(new KeyboardEvent("keydown", { code: "ShiftLeft" }))
    ).toBeUndefined()
})
