import type React from "react"

import {
    getTranslationMarkStyle,
    TRANSLATION_MARK_PATH_STYLE,
    TRANSLATION_MARK_PATHS
} from "@/utils/translationMark"

import type { TranslationMarkProps } from "./types"

export const TranslationMark: React.FC<TranslationMarkProps> = ({
    placement = "inline"
}) => {
    return (
        <svg
            className="mewcat-translation-mark"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            style={getTranslationMarkStyle(placement)}
        >
            {TRANSLATION_MARK_PATHS.map(({ d, fill }) => (
                <path
                    key={d}
                    d={d}
                    style={{ ...TRANSLATION_MARK_PATH_STYLE, fill }}
                />
            ))}
        </svg>
    )
}
