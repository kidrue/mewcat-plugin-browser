const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const { test } = require("node:test")

test("generated hotlink rules stay valid across Windows and Linux checkout paths", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mewcat-hotlink-"))
    try {
        fs.mkdirSync(path.join(root, "scripts"), { recursive: true })
        fs.mkdirSync(path.join(root, "src/public/assets"), { recursive: true })
        fs.mkdirSync(path.join(root, "src/background/config"), {
            recursive: true
        })
        const script = path.join(
            root,
            "scripts/sync-hotlink-sites-from-immersive.cjs"
        )
        fs.copyFileSync(
            path.resolve(
                __dirname,
                "../scripts/sync-hotlink-sites-from-immersive.cjs"
            ),
            script
        )
        const source = path.join(
            root,
            "src/public/assets/request_modifier_rule.json"
        )
        const output = path.join(
            root,
            "src/background/config/hotlink-sites.generated.ts"
        )
        const fixture =
            '[\n  {"id":1,"condition":{"urlFilter":"https://example.com/*"},"action":{"requestHeaders":[{"header":"referer","operation":"set","value":"https://example.com/"}]}}\n]\n'
        const run = (separator, check = false) => {
            const bootstrap = `const path=require('node:path');const relative=path.relative;path.relative=(...args)=>relative(...args).replace(/[\\\\/]/g,${JSON.stringify(separator)});require(${JSON.stringify(script)})`
            return execFileSync(
                process.execPath,
                ["-e", bootstrap, "--", ...(check ? ["--check"] : [])],
                { encoding: "utf8" }
            )
        }
        fs.writeFileSync(source, fixture.replace(/\n/g, "\r\n"))
        run("\\")
        const windowsOutput = fs.readFileSync(output, "utf8")
        assert.match(
            windowsOutput,
            /sourcePath: "src\/public\/assets\/request_modifier_rule\.json"/
        )
        fs.writeFileSync(source, fixture)
        assert.match(run("/", true), /generated file is up to date/)
        fs.writeFileSync(output, windowsOutput.replace(/\n/g, "\r\n"))
        assert.match(run("/", true), /generated file is up to date/)
        run("/")
        assert.equal(fs.readFileSync(output, "utf8"), windowsOutput)
    } finally {
        fs.rmSync(root, { recursive: true, force: true })
    }
})
