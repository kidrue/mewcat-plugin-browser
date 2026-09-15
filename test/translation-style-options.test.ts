// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { TRANSLATION_STYLE_OPTIONS } from "@/constants/options"
import { ImmersiveTranslator } from "@/translation/ImmersiveTranslator"
import { TranslationStyle } from "@/types/translationStyle"
import { createTranslationDisplayElement } from "@/utils/dom"
import {
    getStyleDescription,
    getTranslationElementTag,
    shouldInsertAsBlock
} from "@/utils/style"
import { getTranslationMarkStyle } from "@/utils/translationMark"

describe("empty page translation results", () => {
    it.each(
        [
            "",
            " \n\t",
            "<span></span>",
            "<br>",
            "&nbsp;",
            "<span> &nbsp; </span>"
        ].flatMap(text => [false, true].map(previous => ({ text, previous })))
    )(
        "removes translation decoration and spacing for $text (previous: $previous)",
        ({ text, previous }) => {
            const container = document.createElement("font")
            container.style.display = "block"
            const loading = document.createElement("span")
            const previousTranslation = previous
                ? createTranslationDisplayElement("旧译文")
                : undefined
            container.append(loading)
            if (previousTranslation) container.append(previousTranslation)
            const node = {
                id: "node-1",
                container,
                loading,
                translate: previousTranslation,
                status: "loading"
            }
            const translator = Object.create(ImmersiveTranslator.prototype)
            Object.assign(translator, {
                sourceTextNodes: [
                    {
                        id: "node-1",
                        originText: "Original text",
                        insertTagType: "br"
                    }
                ],
                translationNodes: [node],
                stayOriginalMap: {},
                translationStyle: TranslationStyle.HIGHLIGHT
            })

            translator.renderBatch([{ id: "node-1", text }])

            expect(container.querySelector(".mewcat-wrapper")).toBeNull()
            expect(container.contains(loading)).toBe(false)
            expect(container.hidden).toBe(true)
            expect(container.style.display).toBe("none")

            translator.renderBatch([{ id: "node-1", text: "<b>新译文</b>" }])

            expect(container.hidden).toBe(false)
            expect(container.style.display).toBe("block")
            expect(
                container.querySelector(".mewcat-wrapper b")?.textContent
            ).toBe("新译文")
        }
    )
})

describe("additional translation styles", () => {
    it("offers three distinct styles with the corresponding insertion layout", () => {
        const expected = [
            { value: TranslationStyle.SIDE_LINE, label: "侧边线", block: true },
            {
                value: TranslationStyle.MARKER,
                label: "柔和荧光笔",
                block: false
            },
            {
                value: TranslationStyle.LETTER_DIVIDER,
                label: "信纸分隔",
                block: true
            }
        ]

        for (const { value, label, block } of expected) {
            expect(TRANSLATION_STYLE_OPTIONS).toContainEqual({ value, label })
            expect(getStyleDescription(value)).toContain(label)
            expect(shouldInsertAsBlock(value)).toBe(block)
            expect(getTranslationElementTag(value)).toBe(block ? "div" : "span")
        }
    })

    it("renders a transparent side line, inline marker, and top divider", () => {
        const line = createTranslationDisplayElement(
            "侧边线",
            TranslationStyle.SIDE_LINE
        ) as HTMLElement
        const marker = createTranslationDisplayElement(
            "荧光笔",
            TranslationStyle.MARKER
        ) as HTMLElement
        const divider = createTranslationDisplayElement(
            "分隔",
            TranslationStyle.LETTER_DIVIDER
        ) as HTMLElement

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
        for (const placement of [
            "inline",
            "corner",
            "border-corner",
            "plain"
        ] as const) {
            expect(getTranslationMarkStyle(placement).display).toBe("none")
        }
        const element = createTranslationDisplayElement(
            "译文",
            TranslationStyle.HIGHLIGHT
        )
        const mark = element.querySelector(
            ".mewcat-translation-mark"
        ) as SVGSVGElement
        expect(mark.style.display).toBe("none")
        expect(mark.style.getPropertyPriority("display")).toBe("important")
        expect((element as HTMLElement).style.paddingRight).toBe("0.7em")
    })
})
