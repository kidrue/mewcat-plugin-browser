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

it("previews the nearest CSS block and translates that same block", () => {
    document.body.innerHTML =
        '<section><div id="target"><span>Hovered <b>paragraph text</b></span></div><p>Sibling content</p></section>'
    const target = document.querySelector("#target")!
    const inner = document.querySelector("b")!
    Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: () => inner
    })
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
        new DOMRect(20, 30, 300, 60)
    )
    const trigger = vi.fn()
    cleanup = installParagraphShortcut("Alt+KeyQ", trigger)
    inner.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 25, clientY: 35 })
    )
    const preview = document.querySelector<HTMLElement>(
        "[data-mewcat-paragraph-preview]"
    )!
    expect(preview).not.toBeNull()
    expect(preview.style.pointerEvents).toBe("none")
    expect(preview.style.left).toBe("20px")
    expect(preview.style.width).toBe("300px")
    expect(preview.shadowRoot?.textContent).toContain("Alt+Q")
    expect(trigger).not.toHaveBeenCalled()
    document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyQ", altKey: true })
    )
    expect(trigger).toHaveBeenCalledWith(target)
    cleanup()
    expect(document.querySelector("[data-mewcat-paragraph-preview]")).toBeNull()
})

it.each(["code", "pre", "kbd", "samp", "button", "[contenteditable]"])(
    "never previews or triggers inside %s",
    selector => {
        document.body.innerHTML =
            '<article><p>Readable text <code><span>code text</span></code><kbd>Keyboard code</kbd><samp>Program output</samp></p><pre>Source code</pre><button>Action</button><div contenteditable="true">Editor text</div></article>'
        const element = document.querySelector(selector)!
        Object.defineProperty(document, "elementFromPoint", {
            configurable: true,
            value: () => element.firstElementChild ?? element
        })
        const trigger = vi.fn()
        cleanup = installParagraphShortcut("Alt+KeyQ", trigger)
        element.dispatchEvent(
            new MouseEvent("mousemove", {
                bubbles: true,
                clientX: 20,
                clientY: 30
            })
        )
        document.dispatchEvent(
            new KeyboardEvent("keydown", { code: "KeyQ", altKey: true })
        )
        expect(trigger).not.toHaveBeenCalled()
        expect(
            document.querySelector("[data-mewcat-paragraph-preview]")
        ).toBeNull()
    }
)

it.each(["scroll", "blur", "resize"])(
    "clears the hover preview on %s",
    event => {
        document.body.innerHTML = "<p>Hovered text</p>"
        const target = document.querySelector("p")!
        Object.defineProperty(document, "elementFromPoint", {
            configurable: true,
            value: () => target
        })
        vi.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockReturnValue(new DOMRect(20, 30, 300, 60))
        const trigger = vi.fn()
        cleanup = installParagraphShortcut("Alt+KeyQ", trigger)
        target.dispatchEvent(
            new MouseEvent("mousemove", {
                bubbles: true,
                clientX: 20,
                clientY: 30
            })
        )
        expect(
            document.querySelector("[data-mewcat-paragraph-preview]")
        ).not.toBeNull()
        window.dispatchEvent(new Event(event))
        expect(
            document.querySelector("[data-mewcat-paragraph-preview]")
        ).toBeNull()
        document.dispatchEvent(
            new KeyboardEvent("keydown", { code: "KeyQ", altKey: true })
        )
        expect(trigger).not.toHaveBeenCalled()
    }
)
