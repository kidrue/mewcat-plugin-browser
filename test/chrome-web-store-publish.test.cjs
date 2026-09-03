const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { describe, it } = require("node:test")
const { strToU8, zipSync } = require("fflate")

const {
    ChromeWebStoreError,
    publishChromeWebStore,
    readZipManifestVersion,
    resolveChromeWebStoreConfig
} = require("../scripts/chrome-web-store.cjs")

const jsonResponse = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    async json() {
        return data
    }
})

const baseOptions = {
    accessToken: "short-lived-access-token",
    publisherId: "publisher-123",
    extensionId: "abcdefghijklmnopabcdefghijklmnop",
    zipPath: "dist-assets/mewcat-v0.0.2.zip",
    expectedVersion: "0.0.2",
    readFile: async () => Buffer.from("zip-content"),
    readPackageVersion: async () => "0.0.2",
    sleep: async () => {},
    log: () => {}
}

describe("Chrome Web Store publisher", () => {
    it("reads the version from the root manifest inside a real ZIP", () => {
        const packageBuffer = Buffer.from(
            zipSync({
                "manifest.json": strToU8(
                    JSON.stringify({ manifest_version: 3, version: "0.0.2" })
                )
            })
        )

        assert.equal(readZipManifestVersion(packageBuffer), "0.0.2")
    })

    it("uploads the package and submits it for automatic publishing after review", async () => {
        const requests = []
        const fetchImpl = async (url, init = {}) => {
            requests.push({ url, init })
            if (requests.length === 1) {
                return jsonResponse({
                    publishedItemRevisionStatus: {
                        distributionChannels: [{ crxVersion: "0.0.1" }]
                    }
                })
            }
            if (requests.length === 2) {
                return jsonResponse({
                    uploadState: "SUCCEEDED",
                    crxVersion: "0.0.2"
                })
            }
            return jsonResponse({ state: "PENDING_REVIEW" })
        }

        const result = await publishChromeWebStore({
            ...baseOptions,
            fetchImpl
        })

        assert.deepEqual(result, {
            status: "submitted",
            version: "0.0.2",
            state: "PENDING_REVIEW"
        })
        assert.equal(requests[0].init.method, "GET")
        assert.match(
            requests[1].url,
            /\/upload\/v2\/publishers\/publisher-123\/items\/abcdefghijklmnopabcdefghijklmnop:upload$/
        )
        assert.equal(requests[1].init.method, "POST")
        assert.equal(
            requests[1].init.headers.Authorization,
            "Bearer short-lived-access-token"
        )
        assert.deepEqual(requests[1].init.body, Buffer.from("zip-content"))
        assert.equal(requests[2].init.method, "POST")
        assert.deepEqual(JSON.parse(requests[2].init.body), {
            publishType: "DEFAULT_PUBLISH",
            skipReview: false,
            blockOnWarnings: true
        })
        assert.ok(
            requests.every(
                request => request.init.signal instanceof AbortSignal
            )
        )
    })

    it("does not upload again when the same version is already submitted", async () => {
        let requestCount = 0
        const result = await publishChromeWebStore({
            ...baseOptions,
            fetchImpl: async () => {
                requestCount += 1
                return jsonResponse({
                    submittedItemRevisionStatus: {
                        state: "PENDING_REVIEW",
                        distributionChannels: [{ crxVersion: "0.0.2" }]
                    }
                })
            }
        })

        assert.deepEqual(result, {
            status: "already-submitted",
            version: "0.0.2",
            state: "PENDING_REVIEW"
        })
        assert.equal(requestCount, 1)
    })

    it("fails closed when the same version was rejected", async () => {
        let requestCount = 0

        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                fetchImpl: async () => {
                    requestCount += 1
                    return jsonResponse({
                        submittedItemRevisionStatus: {
                            state: "REJECTED",
                            distributionChannels: [{ crxVersion: "0.0.2" }]
                        }
                    })
                }
            }),
            /v0\.0\.2.*REJECTED/
        )
        assert.equal(requestCount, 1)
    })

    it("publishes an already approved staged revision without uploading again", async () => {
        const requests = []
        const result = await publishChromeWebStore({
            ...baseOptions,
            fetchImpl: async (url, init = {}) => {
                requests.push({ url, init })
                if (requests.length === 1) {
                    return jsonResponse({
                        submittedItemRevisionStatus: {
                            state: "STAGED",
                            distributionChannels: [{ crxVersion: "0.0.2" }]
                        }
                    })
                }
                return jsonResponse({ state: "PUBLISHED" })
            }
        })

        assert.deepEqual(result, {
            status: "published-staged",
            version: "0.0.2",
            state: "PUBLISHED"
        })
        assert.equal(requests.length, 2)
        assert.match(requests[1].url, /:publish$/)
        assert.equal(
            JSON.parse(requests[1].init.body).publishType,
            "STAGED_PUBLISH"
        )
    })

    it("fails closed when publishing a staged revision does not go live", async () => {
        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                fetchImpl: async (_url, init = {}) =>
                    init.method === "GET"
                        ? jsonResponse({
                              submittedItemRevisionStatus: {
                                  state: "STAGED",
                                  distributionChannels: [
                                      { crxVersion: "0.0.2" }
                                  ]
                              }
                          })
                        : jsonResponse({ state: "STAGED" })
            }),
            /发布结果状态为 STAGED/
        )
    })

    it("recognizes the target version in any published distribution channel", async () => {
        let requestCount = 0
        const result = await publishChromeWebStore({
            ...baseOptions,
            fetchImpl: async () => {
                requestCount += 1
                return jsonResponse({
                    publishedItemRevisionStatus: {
                        state: "PUBLISHED",
                        distributionChannels: [
                            { crxVersion: "0.0.1", deployPercentage: 90 },
                            { crxVersion: "0.0.2", deployPercentage: 10 }
                        ]
                    }
                })
            }
        })

        assert.equal(result.status, "already-published")
        assert.equal(requestCount, 1)
    })

    it("rejects an older target even when another channel still has that version", async () => {
        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                expectedVersion: "1.2",
                readPackageVersion: async () => "1.2",
                fetchImpl: async () =>
                    jsonResponse({
                        publishedItemRevisionStatus: {
                            state: "PUBLISHED",
                            distributionChannels: [
                                { crxVersion: "1.2", deployPercentage: 90 },
                                { crxVersion: "1.3", deployPercentage: 10 }
                            ]
                        }
                    })
            }),
            /商店已有更高版本 1\.3/
        )
    })

    it("prioritizes a higher submitted channel over an older matching channel", async () => {
        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                expectedVersion: "1.2",
                readPackageVersion: async () => "1.2",
                fetchImpl: async () =>
                    jsonResponse({
                        submittedItemRevisionStatus: {
                            state: "PENDING_REVIEW",
                            distributionChannels: [
                                { crxVersion: "1.2" },
                                { crxVersion: "1.3" }
                            ]
                        }
                    })
            }),
            /商店已有更高的已提交版本 1\.3/
        )
    })

    it("treats missing trailing Chrome version segments as zero", async () => {
        const result = await publishChromeWebStore({
            ...baseOptions,
            expectedVersion: "1.2.0",
            readPackageVersion: async () => "1.2.0",
            fetchImpl: async () =>
                jsonResponse({
                    publishedItemRevisionStatus: {
                        state: "PUBLISHED",
                        distributionChannels: [{ crxVersion: "1.2" }]
                    }
                })
        })

        assert.equal(result.status, "already-published")
    })

    it("refuses to upload a version lower than a published store version", async () => {
        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                expectedVersion: "1.2",
                readPackageVersion: async () => "1.2",
                fetchImpl: async () =>
                    jsonResponse({
                        publishedItemRevisionStatus: {
                            state: "PUBLISHED",
                            distributionChannels: [{ crxVersion: "1.3" }]
                        }
                    })
            }),
            /商店已有更高版本 1\.3/
        )
    })

    it("polls an asynchronous upload before submitting it", async () => {
        const responses = [
            {},
            { uploadState: "IN_PROGRESS" },
            { lastAsyncUploadState: "IN_PROGRESS" },
            { lastAsyncUploadState: "SUCCEEDED" },
            { state: "PENDING_REVIEW" }
        ]
        let sleepCount = 0

        const result = await publishChromeWebStore({
            ...baseOptions,
            fetchImpl: async () => jsonResponse(responses.shift()),
            sleep: async () => {
                sleepCount += 1
            }
        })

        assert.equal(result.status, "submitted")
        assert.equal(sleepCount, 2)
    })

    it("waits for an existing asynchronous upload before starting a new upload", async () => {
        const requests = []
        const responses = [
            { lastAsyncUploadState: "IN_PROGRESS" },
            { lastAsyncUploadState: "IN_PROGRESS" },
            { lastAsyncUploadState: "SUCCEEDED" },
            { uploadState: "SUCCEEDED", crxVersion: "0.0.2" },
            { state: "PENDING_REVIEW" }
        ]

        const result = await publishChromeWebStore({
            ...baseOptions,
            fetchImpl: async (url, init = {}) => {
                requests.push({ url, init })
                return jsonResponse(responses.shift())
            },
            sleep: async () => {}
        })

        assert.equal(result.status, "submitted")
        assert.equal(requests[0].init.method, "GET")
        assert.equal(requests[1].init.method, "GET")
        assert.equal(requests[2].init.method, "GET")
        assert.match(requests[3].url, /\/upload\/v2\//)
    })

    it("rejects a ZIP whose root manifest version differs from package.json", async () => {
        let requestCount = 0

        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                readPackageVersion: async () => "0.0.1",
                fetchImpl: async () => {
                    requestCount += 1
                    return jsonResponse({})
                }
            }),
            /ZIP.*0\.0\.1.*0\.0\.2/
        )
        assert.equal(requestCount, 0)
    })

    it("validates the local ZIP before an idempotent early return", async () => {
        let requestCount = 0

        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                readPackageVersion: async () => "0.0.1",
                fetchImpl: async () => {
                    requestCount += 1
                    return jsonResponse({
                        submittedItemRevisionStatus: {
                            state: "PENDING_REVIEW",
                            distributionChannels: [{ crxVersion: "0.0.2" }]
                        }
                    })
                }
            }),
            /ZIP.*0\.0\.1.*0\.0\.2/
        )
        assert.equal(requestCount, 0)
    })

    it("fails closed when the publish API returns a rejected state", async () => {
        const responses = [
            {},
            { uploadState: "SUCCEEDED", crxVersion: "0.0.2" },
            { state: "REJECTED" }
        ]

        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                fetchImpl: async () => jsonResponse(responses.shift())
            }),
            /发布结果状态为 REJECTED/
        )
    })

    it("stops when Chrome Web Store reports that the item was taken down", async () => {
        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                fetchImpl: async () => jsonResponse({ takenDown: true })
            }),
            /已被下架/
        )
    })

    it("stops when Chrome Web Store reports a publisher warning", async () => {
        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                fetchImpl: async () => jsonResponse({ warned: true })
            }),
            /发布警告/
        )
    })

    it("aborts a Chrome Web Store request that exceeds its timeout", async () => {
        await assert.rejects(
            publishChromeWebStore({
                ...baseOptions,
                requestTimeoutMs: 1,
                fetchImpl: async (_url, init = {}) =>
                    new Promise((resolve, reject) => {
                        const keepAlive = setInterval(() => {}, 100)
                        init.signal.addEventListener(
                            "abort",
                            () => {
                                clearInterval(keepAlive)
                                reject(init.signal.reason)
                            },
                            { once: true }
                        )
                    })
            }),
            error => error?.name === "TimeoutError"
        )
    })

    it("rejects missing or unsafe configuration without exposing the access token", () => {
        assert.throws(
            () =>
                resolveChromeWebStoreConfig({
                    CWS_ACCESS_TOKEN: "do-not-print-this",
                    CWS_PUBLISHER_ID: "../unsafe",
                    CWS_EXTENSION_ID: "extension-id",
                    CWS_ZIP_PATH: "extension.zip",
                    CWS_EXPECTED_VERSION: "0.0.2"
                }),
            error => {
                assert.ok(error instanceof ChromeWebStoreError)
                assert.match(error.message, /CWS_PUBLISHER_ID/)
                assert.doesNotMatch(error.message, /do-not-print-this/)
                return true
            }
        )
    })

    it("rejects versions that Chrome Web Store cannot accept", () => {
        for (const invalidVersion of ["99999", "01.2", "0.0.0"]) {
            assert.throws(
                () =>
                    resolveChromeWebStoreConfig({
                        CWS_ACCESS_TOKEN: "short-lived-token",
                        CWS_PUBLISHER_ID: "publisher-123",
                        CWS_EXTENSION_ID: "abcdefghijklmnopabcdefghijklmnop",
                        CWS_ZIP_PATH: "extension.zip",
                        CWS_EXPECTED_VERSION: invalidVersion
                    }),
                /CWS_EXPECTED_VERSION/
            )
        }
    })
})

describe("Chrome Web Store release workflow", () => {
    it("keeps local environment files out of the public repository", () => {
        const gitignore = fs.readFileSync(
            path.resolve(__dirname, "../.gitignore"),
            "utf8"
        )

        assert.match(gitignore, /^\.env\.local$/m)
    })

    it("uses OIDC variables and never stores a long-lived Google key", () => {
        const workflow = fs.readFileSync(
            path.resolve(__dirname, "../.github/workflows/release.yml"),
            "utf8"
        )

        assert.match(workflow, /id-token:\s*write/)
        assert.match(workflow, /timeout-minutes:\s*20/)
        assert.match(
            workflow,
            /google-github-actions\/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093/
        )
        assert.match(
            workflow,
            /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/
        )
        assert.match(
            workflow,
            /pnpm\/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa/
        )
        assert.match(
            workflow,
            /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/
        )
        assert.match(workflow, /vars\.CWS_WORKLOAD_IDENTITY_PROVIDER/)
        assert.match(workflow, /vars\.CWS_SERVICE_ACCOUNT/)
        assert.match(workflow, /vars\.CWS_PUBLISHER_ID/)
        assert.match(workflow, /vars\.CWS_EXTENSION_ID/)
        assert.doesNotMatch(workflow, /credentials_json/)
        assert.doesNotMatch(workflow, /secrets\.CWS_/)

        const publishIndex = workflow.indexOf("Publish to Chrome Web Store")
        const draftIndex = workflow.indexOf("Create draft GitHub Release")
        const releaseIndex = workflow.indexOf("Finalize GitHub Release")
        assert.ok(publishIndex > -1)
        assert.ok(draftIndex > -1)
        assert.ok(draftIndex < publishIndex)
        assert.ok(releaseIndex > publishIndex)
        assert.match(workflow, /Download draft release assets/)
        assert.match(workflow, /gh release create[\s\S]*--draft/)
        assert.match(workflow, /recovery\.tar\.gz/)
        assert.match(workflow, /sha256sum -c SHA256SUMS/)
        assert.match(workflow, /gh release delete "\$TAG" --yes/)
        assert.doesNotMatch(workflow, /gh release delete[^\n]*--cleanup-tag/)
    })

    it("documents immutable GitHub numeric IDs for OIDC restrictions", () => {
        const documentation = fs.readFileSync(
            path.resolve(__dirname, "../docs/chrome-web-store-automation.md"),
            "utf8"
        )

        assert.match(documentation, /assertion\.repository_id/)
        assert.match(documentation, /assertion\.repository_owner_id/)
        assert.doesNotMatch(
            documentation,
            /attribute-condition=.*assertion\.repository==/
        )
    })

    it("documents every Google API required by Workload Identity Federation", () => {
        const documentation = fs.readFileSync(
            path.resolve(__dirname, "../docs/chrome-web-store-automation.md"),
            "utf8"
        )

        for (const service of [
            "iam.googleapis.com",
            "cloudresourcemanager.googleapis.com",
            "iamcredentials.googleapis.com",
            "sts.googleapis.com",
            "chromewebstore.googleapis.com"
        ]) {
            assert.match(
                documentation,
                new RegExp(service.replaceAll(".", "\\."))
            )
        }
    })

    it("includes the publisher tests in the project quality gate", () => {
        const packageJson = require("../package.json")

        assert.equal(
            packageJson.scripts["test:chrome-web-store"],
            "node --test test/chrome-web-store-publish.test.cjs"
        )
        assert.match(packageJson.scripts.check, /test:chrome-web-store/)
    })
})
