const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { test } = require("node:test")

const { uploadSentrySourceMaps } = require("../scripts/upload-sentry-sourcemaps.cjs")

function createFixture() {
    const root = path.join(process.cwd(), ".output")
    fs.mkdirSync(root, { recursive: true })
    const directory = fs.mkdtempSync(path.join(root, "sentry-test-"))
    fs.writeFileSync(path.join(directory, "content.js"), "throw new Error('test')")
    fs.writeFileSync(path.join(directory, "content.js.map"), "{}")
    return directory
}

const completeEnv = {
    WXT_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
    SENTRY_ORG: "test-org",
    SENTRY_PROJECT: "test-project",
    SENTRY_AUTH_TOKEN: "test-token"
}

test("skips upload without configuration and removes maps", () => {
    const directory = createFixture()
    try {
        const result = uploadSentrySourceMaps({
            outputDir: directory,
            version: "0.0.5",
            env: {},
            runCli: () => assert.fail("CLI should not run")
        })
        assert.equal(result, "skipped")
        assert.equal(fs.existsSync(path.join(directory, "content.js.map")), false)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test("rejects partial configuration without leaking a credential", () => {
    const directory = createFixture()
    try {
        assert.throws(
            () => uploadSentrySourceMaps({
                outputDir: directory,
                version: "0.0.5",
                env: { ...completeEnv, SENTRY_PROJECT: "" },
                runCli: () => assert.fail("CLI should not run")
            }),
            error => error.message.includes("SENTRY_PROJECT") && !error.message.includes("test-token")
        )
        assert.equal(fs.existsSync(path.join(directory, "content.js.map")), true)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test("injects then uploads before removing maps", () => {
    const directory = createFixture()
    const calls = []
    try {
        assert.equal(uploadSentrySourceMaps({
            outputDir: directory,
            version: "0.0.5",
            env: completeEnv,
            runCli: args => {
                assert.equal(fs.existsSync(path.join(directory, "content.js.map")), true)
                calls.push(args)
            }
        }), "uploaded")
        assert.deepEqual(calls.map(args => args[1]), ["inject", "upload"])
        assert.ok(calls[1].includes("mewcat@0.0.5"))
        assert.equal(fs.existsSync(path.join(directory, "content.js.map")), false)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test("keeps maps when upload fails", () => {
    const directory = createFixture()
    try {
        assert.throws(() => uploadSentrySourceMaps({
            outputDir: directory,
            version: "0.0.5",
            env: completeEnv,
            runCli: args => {
                if (args[1] === "upload") throw new Error("upload failed")
            }
        }), /upload failed/)
        assert.equal(fs.existsSync(path.join(directory, "content.js.map")), true)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test("refuses directories outside the build output", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sentry-outside-"))
    try {
        assert.throws(() => uploadSentrySourceMaps({
            outputDir: directory,
            version: "0.0.5",
            env: {}
        }), /不在 .output 内/)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})
