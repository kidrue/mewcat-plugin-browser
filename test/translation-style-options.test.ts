// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { TRANSLATION_STYLE_OPTIONS } from "@/constants/options"
import { TranslationStyle } from "@/types/translationStyle"
import { createTranslationDisplayElement } from "@/utils/dom"
import {
    getStyleDescription,
    getTranslationElementTag,
    shouldInsertAsBlock
} from "@/utils/style"
import { getTranslationMarkStyle } from "@/utils/translationMark"

describe("additional translation styles", () => {
    it("offers three distinct styles with the corresponding insertion layout", () => {
        const expected = [
            { value: TranslationStyle.SIDE_LINE, label: "侧边线", block: true },
            { value: TranslationStyle.MARKER, label: "柔和荧光笔", block: false },
            { value: TranslationStyle.LETTER_DIVIDER, label: "信纸分隔", block: true }
        ]

        for (const { value, label, block } of expected) {
            expect(TRANSLATION_STYLE_OPTIONS).toContainEqual({ value, label })
            expect(getStyleDescription(value)).toContain(label)
            expect(shouldInsertAsBlock(value)).toBe(block)
            expect(getTranslationElementTag(value)).toBe(block ? "div" : "span")
        }
    })

    it("renders a transparent side line, inline marker, and top divider", () => {
        const line = createTranslationDisplayElement("侧边线", TranslationStyle.SIDE_LINE) as HTMLElement
        const marker = createTranslationDisplayElement("荧光笔", TranslationStyle.MARKER) as HTMLElement
        const divider = createTranslationDisplayElement("分隔", TranslationStyle.LETTER_DIVIDER) as HTMLElement

        expect(line.style.borderLeftStyle).toBe("solid")
        expect(line.style.backgroundColor).toBe("transparent")
        expect(marker.style.display).toBe("inline")
        expect(marker.style.backgroundImage).toContain("linear-gradient")
        expect(divider.style.borderTopStyle).toBe("dashed")
        expect(divider.style.backgroundColor).toBe("transparent")
    })
})

describe("temporarily hidden translation mark", () => {
    it("does not show the mark in any placement or occupy text width", () => {
        for (const placement of ["inline", "corner", "border-corner", "plain"] as const) {
            expect(getTranslationMarkStyle(placement).display).toBe("none")
        }
        const element = createTranslationDisplayElement("译文", TranslationStyle.HIGHLIGHT)
        const mark = element.querySelector(".mewcat-translation-mark") as SVGSVGElement
        expect(mark.style.display).toBe("none")
        expect(mark.style.getPropertyPriority("display")).toBe("important")
        expect((element as HTMLElement).style.paddingRight).toBe("0.7em")
    })
})
