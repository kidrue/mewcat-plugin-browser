import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, join, resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const bash =
    process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash"
const directories: string[] = []
const tag = (digit: string) => digit.repeat(40)

async function fixture(
    options: { history?: string[]; used?: string[]; failList?: boolean } = {}
) {
    const directory = await mkdtemp(join(tmpdir(), "mewcat-image-cleanup-"))
    directories.push(directory)
    const bin = join(directory, "bin")
    const state = join(directory, "state")
    await Promise.all([
        mkdir(bin),
        mkdir(state),
        mkdir(join(directory, ".deploy", "releases"), { recursive: true })
    ])
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
        const release = join(
            directory,
            ".deploy",
            "releases",
            `release-${digit}`
        )
        await mkdir(release)
        await writeFile(
            join(release, "image.env"),
            `MEWCAT_IMAGE_TAG=${tag(digit)}\n`
        )
    }
    await writeFile(
        join(directory, ".deploy", "successful-images"),
        (options.history ?? []).join("\n")
    )
    const images = ["1", "2", "3", "4", "5", "6", "a"].flatMap(digit => [
        `mewcat-api:${tag(digit)} sha256:api-${digit}`,
        `mewcat-tools:${tag(digit)} sha256:tools-${digit}`
    ])
    images.push(`other-service:${tag("1")} sha256:other`)
    await writeFile(join(state, "images"), `${images.join("\n")}\n`)
    await writeFile(join(state, "used"), (options.used ?? []).join("\n"))
    await writeFile(join(state, "removed"), "")
    await writeFile(
        join(bin, "docker"),
        `#!/usr/bin/env bash
set -eu
case "$1 $2" in
  'image ls')
    if [[ "\u0024{MOCK_FAIL_LIST:-}" == 1 ]]; then exit 1; fi
    cat "$MOCK_STATE/images" ;;
  'container ls')
    [[ $# == 3 && "$3" == -aq ]]
    if [[ -s "$MOCK_STATE/used" ]]; then printf 'container-1\\n'; fi ;;
  'container inspect') cat "$MOCK_STATE/used" ;;
  'image rm')
    [[ $# == 3 && "$3" != -* ]]
    printf '%s\\n' "$3" >> "$MOCK_STATE/removed" ;;
  *) echo "Unexpected Docker command: $*" >&2; exit 2 ;;
esac
`,
        { mode: 0o755 }
    )
    return {
        directory,
        run: () =>
            spawnSync(
                bash,
                [
                    resolve("deploy/cleanup-images.sh").replaceAll("\\", "/"),
                    directory.replaceAll("\\", "/"),
                    tag("5")
                ],
                {
                    encoding: "utf8",
                    windowsHide: true,
                    env: {
                        ...process.env,
                        PATH: `${bin}${delimiter}${process.env.PATH}`,
                        MOCK_STATE: state.replaceAll("\\", "/"),
                        MOCK_FAIL_LIST: options.failList ? "1" : ""
                    }
                }
            ),
        removed: async () =>
            (await readFile(join(state, "removed"), "utf8"))
                .trim()
                .split("\n")
                .filter(Boolean),
        history: async () =>
            (
                await readFile(
                    join(directory, ".deploy", "successful-images"),
                    "utf8"
                )
            )
                .trim()
                .split("\n")
    }
}

afterEach(async () => {
    await Promise.all(
        directories
            .splice(0)
            .map(directory => rm(directory, { recursive: true, force: true }))
    )
})

describe("部署镜像自动清理", () => {
    it("仅保留当前成功版本，删除全部旧版本及失败版本，仅处理本项目发布过的镜像", async () => {
        const setup = await fixture({ history: [tag("4"), tag("3"), tag("2")] })
        const result = setup.run()
        expect(result.stderr).toBe("")
        expect(result.status).toBe(0)
        expect(await setup.history()).toEqual([tag("5")])
        expect((await setup.removed()).sort()).toEqual(
            ["1", "2", "3", "4", "6"]
                .flatMap(digit => [
                    `mewcat-api:${tag(digit)}`,
                    `mewcat-tools:${tag(digit)}`
                ])
                .sort()
        )
    })

    it("保护被容器引用的旧镜像，包括已停止的容器", async () => {
        const setup = await fixture({
            history: [tag("4"), tag("3")],
            used: ["sha256:api-1", "sha256:tools-2"]
        })
        const result = setup.run()
        expect(result.status).toBe(0)
        expect(await setup.removed()).toEqual(
            expect.arrayContaining([
                `mewcat-tools:${tag("1")}`,
                `mewcat-api:${tag("2")}`
            ])
        )
        expect(await setup.removed()).not.toContain(`mewcat-api:${tag("1")}`)
        expect(await setup.removed()).not.toContain(`mewcat-tools:${tag("2")}`)
    })

    it("首次启用及重复部署均只保留当前成功版本", async () => {
        const setup = await fixture()
        expect(setup.run().status).toBe(0)
        expect(setup.run().status).toBe(0)
        expect(await setup.history()).toEqual([tag("5")])
        expect(await setup.removed()).toContain(`mewcat-api:${tag("4")}`)
        expect(await setup.removed()).not.toContain(`mewcat-api:${tag("5")}`)
    })

    it("无法列出 Docker 镜像时停止清理，不删除任何镜像", async () => {
        const setup = await fixture({ failList: true })
        expect(setup.run().status).not.toBe(0)
        expect(await setup.removed()).toEqual([])
    })
})
