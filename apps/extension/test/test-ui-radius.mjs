import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = path =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const theme = read("src/styles/theme.scss")

for (const [token, value] of Object.entries({
    "radius-sm": "6px",
    "radius-md": "8px",
    "radius-lg": "12px",
    "radius-xl": "16px",
    "radius-full": "9999px"
})) {
    assert.match(
        theme,
        new RegExp(`--${token}:\\s*${value};`),
        `Expected --${token} to be ${value}`
    )
}

for (const path of [
    "src/contents/TranslationControlCenter.tsx",
    "src/contents/selectionTranslate.tsx",
    "src/contents/imageTranslate.tsx"
]) {
    assert.match(
        read(path),
        /import ["']@\/styles\/theme\.scss["']/,
        `${path} must load radius tokens into its shadow root`
    )
}

const productionStyleSources = [
    "src/styles/scroll.ts",
    "src/contents/TranslationControlCenter.tsx"
]
    .map(read)
    .join("\n")

assert.doesNotMatch(
    productionStyleSources,
    /var\(--radius-(?:sm|md|lg|xl),\s*(?:[0-8]px)\)/,
    "Radius fallbacks must use the new rounded scale"
)

const injectedStyleExpectations = {
    "src/utils/style.ts": ["border-radius: 6px;"],
    "src/utils/dom.ts": [
        "border-radius: 6px;",
        "border-radius: 12px;",
        "border-radius: 16px;"
    ],
    "src/utils/toast.ts": ["border-radius: 16px;"],
    "src/utils/debugUtils.ts": [
        "border-radius: 8px;",
        "border-radius: 12px;",
        "border-radius: 16px;"
    ],
    "src/translation/DebugManager.ts": ["border-radius: 9999px;"]
}

for (const [path, expectedDeclarations] of Object.entries(
    injectedStyleExpectations
)) {
    const source = read(path)

    assert.doesNotMatch(
        source,
        /border-radius:\s*var\(/,
        `${path} injects styles into host pages and must not depend on host CSS variables`
    )

    for (const declaration of expectedDeclarations) {
        assert.ok(
            source.includes(declaration),
            `${path} must include ${declaration}`
        )
    }
}

console.log("UI radius contract passed")
