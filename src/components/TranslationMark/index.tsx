import {
    getTranslationMarkStyle,
    TRANSLATION_MARK_PATH_STYLE,
    TRANSLATION_MARK_PATHS,
    type TranslationMarkPlacement
} from "@/utils/translationMark"

export default function TranslationMark({
    placement = "inline"
}: {
    placement?: TranslationMarkPlacement
}) {
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
