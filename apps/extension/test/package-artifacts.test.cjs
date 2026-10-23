const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { test } = require("node:test")

const { createArtifactFileName } = require("../scripts/artifact-name.cjs")
const { renameProductionZip } = require("../scripts/package-with-date.cjs")

test("uses the extension name, version and Shanghai time across a year boundary", () => {
    const manifest = { name: "mewCat", version: "1.0.1" }
    const now = new Date("2026-12-31T16:00:05Z")
    assert.equal(
        createArtifactFileName(manifest, "zip", now),
        "mewCat-1.0.1-20270101 000005.zip"
    )
    assert.equal(
        createArtifactFileName(manifest, "crx", now),
        "mewCat-1.0.1-20270101 000005.crx"
    )
})

test("keeps release artifact names stable when the store title changes", () => {
    const manifest = {
        name: "mewCat 译趣喵 - 网页翻译与双语阅读",
        short_name: "mewCat",
        version: "1.1.1"
    }
    const now = new Date("2026-10-24T01:30:25Z")
    for (const extension of ["zip", "crx"]) {
        assert.equal(
            createArtifactFileName(manifest, extension, now),
            `mewCat-1.1.1-20261024 093025.${extension}`
        )
    }
})

test("renames the built ZIP using its manifest and preserves archive contents", () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "mewcat-package-"))
    try {
        fs.mkdirSync(path.join(outputDir, "chrome-mv3"))
        fs.writeFileSync(
            path.join(outputDir, "chrome-mv3", "manifest.json"),
            JSON.stringify({
                name: "mewCat 译趣喵 - 网页翻译与双语阅读",
                short_name: "mewCat",
                version: "2.3.4"
            })
        )
        const contents = Buffer.from("archive contents")
        const source = path.join(outputDir, "chrome-mv3-prod.zip")
        fs.writeFileSync(source, contents)
        const destination = renameProductionZip(
            outputDir,
            new Date("2026-10-08T09:30:25Z")
        )
        assert.equal(
            path.basename(destination),
            "mewCat-2.3.4-20261008 173025.zip"
        )
        assert.deepEqual(fs.readFileSync(destination), contents)
        assert.equal(fs.existsSync(source), false)
    } finally {
        fs.rmSync(outputDir, { recursive: true, force: true })
    }
})
