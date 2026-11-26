import React from "react"

import { shouldInsertAsBlock } from "@/utils/style"

import TranslationMark from "../TranslationMark"
import { SCxOriginalText, SCxPreviewContainer, SCxPreviewText } from "./styles"
import type { StylePreviewProps } from "./types"

export const StylePreview: React.FC<StylePreviewProps> = ({
    style,
    className
}) => {
    return (
        <SCxPreviewContainer className={className}>
            <SCxOriginalText>
                A gentle breeze turns the pages. Take your time and enjoy
                reading.
            </SCxOriginalText>
            <SCxPreviewText styleName={style}>
                微风轻轻翻动书页，慢慢读，让每一段文字都清晰舒展。
                <TranslationMark
                    placement={
                        shouldInsertAsBlock(style) ? "border-corner" : "inline"
                    }
                />
            </SCxPreviewText>
        </SCxPreviewContainer>
    )
}
