import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

let legacyOutputWarning = {}

try {
    legacyOutputWarning = await import("../scripts/check-legacy-output.cjs")
} catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") {
        throw error
    }
}

assert.equal(
    typeof legacyOutputWarning.findLegacyOutputs,
    "function",
    "Expected check-legacy-output.cjs to export findLegacyOutputs"
)
assert.equal(
    typeof legacyOutputWarning.warnAboutLegacyOutputs,
    "function",
    "Expected check-legacy-output.cjs to export warnAboutLegacyOutputs"
)

const projectRoot = mkdtempSync(join(tmpdir(), "mewcat-legacy-output-"))

try {
    const messages = []

    assert.deepEqual(legacyOutputWarning.findLegacyOutputs(projectRoot), [])
    assert.equal(
        legacyOutputWarning.warnAboutLegacyOutputs(projectRoot, message =>
            messages.push(message)
        ),
        false
    )
    assert.deepEqual(messages, [])

    const legacyManifests = [
        "build/chrome-mv3-dev/manifest.json",
        "build/chrome-mv3-prod/manifest.json"
    ]

    for (const relativePath of legacyManifests) {
        const manifestPath = join(projectRoot, relativePath)
        mkdirSync(dirname(manifestPath), { recursive: true })
        writeFileSync(manifestPath, "{}")
    }

    assert.deepEqual(legacyOutputWarning.findLegacyOutputs(projectRoot), [
        "build/chrome-mv3-dev",
        "build/chrome-mv3-prod"
    ])

    assert.equal(
        legacyOutputWarning.warnAboutLegacyOutputs(projectRoot, message =>
            messages.push(message)
        ),
        true
    )
    assert.equal(messages.length, 1)

    for (const expectedText of [
        "build/chrome-mv3-dev",
        "build/chrome-mv3-prod",
        ".output/chrome-mv3-dev",
        ".output/chrome-mv3"
    ]) {
        assert.ok(
            messages[0].includes(expectedText),
            `Expected warning to include ${expectedText}`
        )
    }
} finally {
    rmSync(projectRoot, { recursive: true, force: true })
}

console.log("Legacy output warning contract passed")
