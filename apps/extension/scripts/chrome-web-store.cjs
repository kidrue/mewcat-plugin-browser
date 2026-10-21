#!/usr/bin/env node

const fs = require("node:fs/promises")
const { strFromU8, unzipSync } = require("fflate")

const API_BASE_URL = "https://chromewebstore.googleapis.com"
const DEFAULT_POLL_INTERVAL_MS = 3000
const DEFAULT_MAX_POLL_ATTEMPTS = 20
const DEFAULT_REQUEST_TIMEOUT_MS = 30000

class ChromeWebStoreError extends Error {
    constructor(message) {
        super(message)
        this.name = "ChromeWebStoreError"
    }
}

const requireValue = (environment, name) => {
    const value = environment[name]
    if (typeof value !== "string" || !value.trim()) {
        throw new ChromeWebStoreError(`缺少环境变量 ${name}`)
    }
    return value.trim()
}

const requireSafeIdentifier = (environment, name) => {
    const value = requireValue(environment, name)
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        throw new ChromeWebStoreError(`${name} 格式不合法`)
    }
    return value
}

const parseChromeVersion = (value, label = "版本") => {
    if (typeof value !== "string") {
        throw new ChromeWebStoreError(`${label}格式不合法`)
    }

    const rawSegments = value.split(".")
    if (rawSegments.length < 1 || rawSegments.length > 4) {
        throw new ChromeWebStoreError(`${label}格式不合法`)
    }

    const segments = rawSegments.map(segment => {
        if (!/^(?:0|[1-9]\d*)$/.test(segment)) {
            throw new ChromeWebStoreError(`${label}格式不合法`)
        }
        const number = Number(segment)
        if (number > 65535) {
            throw new ChromeWebStoreError(`${label}格式不合法`)
        }
        return number
    })

    if (segments.every(segment => segment === 0)) {
        throw new ChromeWebStoreError(`${label}格式不合法`)
    }

    return [...segments, 0, 0, 0, 0].slice(0, 4)
}

const compareChromeVersions = (left, right) => {
    const leftSegments = parseChromeVersion(left, `Chrome 版本 ${left} `)
    const rightSegments = parseChromeVersion(right, `Chrome 版本 ${right} `)

    for (let index = 0; index < 4; index += 1) {
        if (leftSegments[index] !== rightSegments[index]) {
            return leftSegments[index] > rightSegments[index] ? 1 : -1
        }
    }
    return 0
}

const readZipManifestVersion = packageBuffer => {
    let archive
    try {
        archive = unzipSync(new Uint8Array(packageBuffer))
    } catch {
        throw new ChromeWebStoreError("无法读取 Chrome Web Store ZIP 安装包")
    }

    const manifestBytes = archive["manifest.json"]
    if (!manifestBytes) {
        throw new ChromeWebStoreError(
            "Chrome Web Store ZIP 根目录缺少 manifest.json"
        )
    }

    let manifest
    try {
        manifest = JSON.parse(strFromU8(manifestBytes))
    } catch {
        throw new ChromeWebStoreError(
            "Chrome Web Store ZIP 中的 manifest.json 无法解析"
        )
    }

    parseChromeVersion(manifest?.version, "ZIP manifest.version ")
    return manifest.version
}

const resolveChromeWebStoreConfig = (environment = process.env) => {
    const expectedVersion = requireValue(environment, "CWS_EXPECTED_VERSION")
    parseChromeVersion(expectedVersion, "CWS_EXPECTED_VERSION ")

    return {
        accessToken: requireValue(environment, "CWS_ACCESS_TOKEN"),
        publisherId: requireSafeIdentifier(environment, "CWS_PUBLISHER_ID"),
        extensionId: requireSafeIdentifier(environment, "CWS_EXTENSION_ID"),
        zipPath: requireValue(environment, "CWS_ZIP_PATH"),
        expectedVersion
    }
}

const readJsonResponse = async (response, operation) => {
    let data = {}
    try {
        data = await response.json()
    } catch {
        // 无 JSON 响应时仍保留 HTTP 状态，避免输出请求头或令牌。
    }

    if (!response.ok) {
        const apiMessage =
            typeof data?.error?.message === "string"
                ? `：${data.error.message}`
                : ""
        throw new ChromeWebStoreError(
            `${operation}失败（HTTP ${response.status}）${apiMessage}`
        )
    }
    return data
}

const getRevisionVersions = revision =>
    (revision?.distributionChannels ?? [])
        .map(channel => channel?.crxVersion)
        .filter(version => typeof version === "string")

const findHighestVersion = versions =>
    versions.reduce(
        (highest, version) =>
            highest === undefined || compareChromeVersions(version, highest) > 0
                ? version
                : highest,
        undefined
    )

const publishChromeWebStore = async options => {
    const {
        accessToken,
        publisherId,
        extensionId,
        zipPath,
        expectedVersion,
        fetchImpl = fetch,
        readFile = fs.readFile,
        readPackageVersion = readZipManifestVersion,
        sleep = delay => new Promise(resolve => setTimeout(resolve, delay)),
        pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
        maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
        requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
        log = console.log
    } = options

    const itemName = `publishers/${publisherId}/items/${extensionId}`
    const authorization = { Authorization: `Bearer ${accessToken}` }
    const statusUrl = `${API_BASE_URL}/v2/${itemName}:fetchStatus`
    const publishUrl = `${API_BASE_URL}/v2/${itemName}:publish`

    const fetchStatus = async () =>
        readJsonResponse(
            await fetchImpl(statusUrl, {
                method: "GET",
                headers: authorization,
                signal: AbortSignal.timeout(requestTimeoutMs)
            }),
            "读取 Chrome Web Store 状态"
        )

    const publishItem = async publishType =>
        readJsonResponse(
            await fetchImpl(publishUrl, {
                method: "POST",
                headers: {
                    ...authorization,
                    "Content-Type": "application/json"
                },
                signal: AbortSignal.timeout(requestTimeoutMs),
                body: JSON.stringify({
                    publishType,
                    skipReview: false,
                    blockOnWarnings: true
                })
            }),
            "提交 Chrome Web Store 审核"
        )

    const requirePublicationState = (publication, allowedStates) => {
        if (!allowedStates.includes(publication.state)) {
            throw new ChromeWebStoreError(
                `Chrome Web Store 发布结果状态为 ${publication.state || "未知"}，拒绝标记为成功`
            )
        }
    }

    const waitForAsyncUpload = async initialState => {
        let uploadState = initialState
        for (
            let attempt = 0;
            uploadState === "IN_PROGRESS" && attempt < maxPollAttempts;
            attempt += 1
        ) {
            await sleep(pollIntervalMs)
            const latestStatus = await fetchStatus()
            uploadState = latestStatus.lastAsyncUploadState
        }

        if (uploadState !== "SUCCEEDED") {
            const reason =
                uploadState === "IN_PROGRESS" ? "处理超时" : uploadState
            throw new ChromeWebStoreError(
                `Chrome Web Store 安装包上传未完成：${reason || "未知状态"}`
            )
        }
    }

    const packageBuffer = await readFile(zipPath)
    const packageVersion = await readPackageVersion(packageBuffer, zipPath)
    if (packageVersion !== expectedVersion) {
        throw new ChromeWebStoreError(
            `ZIP manifest.version ${packageVersion} 与预期版本 ${expectedVersion} 不一致`
        )
    }

    const status = await fetchStatus()
    if (status.takenDown) {
        throw new ChromeWebStoreError(
            "Chrome Web Store 扩展已被下架，拒绝自动发布"
        )
    }
    if (status.warned) {
        throw new ChromeWebStoreError(
            "Chrome Web Store 返回发布警告，拒绝自动发布"
        )
    }

    const publishedVersions = getRevisionVersions(
        status.publishedItemRevisionStatus
    )
    const highestPublishedVersion = findHighestVersion(publishedVersions)
    if (
        highestPublishedVersion &&
        compareChromeVersions(highestPublishedVersion, expectedVersion) > 0
    ) {
        throw new ChromeWebStoreError(
            `商店已有更高版本 ${highestPublishedVersion}，拒绝上传 v${expectedVersion}`
        )
    }
    if (
        publishedVersions.some(
            version => compareChromeVersions(version, expectedVersion) === 0
        )
    ) {
        log(`Chrome Web Store 已发布 v${expectedVersion}，跳过重复操作`)
        return {
            status: "already-published",
            version: expectedVersion,
            state: status.publishedItemRevisionStatus?.state
        }
    }

    const submittedVersions = getRevisionVersions(
        status.submittedItemRevisionStatus
    )
    const highestSubmittedVersion = findHighestVersion(submittedVersions)
    if (
        highestSubmittedVersion &&
        compareChromeVersions(highestSubmittedVersion, expectedVersion) > 0
    ) {
        throw new ChromeWebStoreError(
            `商店已有更高的已提交版本 ${highestSubmittedVersion}，拒绝上传 v${expectedVersion}`
        )
    }
    if (
        submittedVersions.some(
            version => compareChromeVersions(version, expectedVersion) === 0
        )
    ) {
        const submittedState = status.submittedItemRevisionStatus?.state
        if (submittedState === "PENDING_REVIEW") {
            log(`Chrome Web Store 已提交 v${expectedVersion}，跳过重复上传`)
            return {
                status: "already-submitted",
                version: expectedVersion,
                state: submittedState
            }
        }
        if (submittedState === "STAGED") {
            const publication = await publishItem("STAGED_PUBLISH")
            requirePublicationState(publication, [
                "PUBLISHED",
                "PUBLISHED_TO_TESTERS"
            ])
            log(`Chrome Web Store v${expectedVersion} 已从暂存状态发布`)
            return {
                status: "published-staged",
                version: expectedVersion,
                state: publication.state
            }
        }
        throw new ChromeWebStoreError(
            `Chrome Web Store v${expectedVersion} 的已有提交状态为 ${submittedState || "未知"}，拒绝继续发布`
        )
    }

    if (submittedVersions.length > 0) {
        throw new ChromeWebStoreError(
            `商店存在其他版本 ${highestSubmittedVersion} 的提交，拒绝并行上传 v${expectedVersion}`
        )
    }

    if (status.lastAsyncUploadState === "IN_PROGRESS") {
        log("Chrome Web Store 已有安装包正在处理，等待完成后再上传")
        await waitForAsyncUpload(status.lastAsyncUploadState)
    }

    const uploadUrl = `${API_BASE_URL}/upload/v2/${itemName}:upload`
    const upload = await readJsonResponse(
        await fetchImpl(uploadUrl, {
            method: "POST",
            headers: {
                ...authorization,
                "Content-Type": "application/zip"
            },
            signal: AbortSignal.timeout(requestTimeoutMs),
            body: packageBuffer
        }),
        "上传 Chrome Web Store 安装包"
    )

    if (upload.crxVersion && upload.crxVersion !== expectedVersion) {
        throw new ChromeWebStoreError(
            `上传包版本 ${upload.crxVersion} 与预期版本 ${expectedVersion} 不一致`
        )
    }
    await waitForAsyncUpload(upload.uploadState)

    const publication = await publishItem("DEFAULT_PUBLISH")
    requirePublicationState(publication, [
        "PENDING_REVIEW",
        "PUBLISHED",
        "PUBLISHED_TO_TESTERS"
    ])

    log(`Chrome Web Store v${expectedVersion} 已提交审核`)
    return {
        status: "submitted",
        version: expectedVersion,
        state: publication.state
    }
}

const main = async () => {
    const config = resolveChromeWebStoreConfig()
    await publishChromeWebStore(config)
}

if (require.main === module) {
    main().catch(error => {
        const message = error instanceof Error ? error.message : "未知发布错误"
        console.error(`❌ Chrome Web Store 发布失败：${message}`)
        process.exitCode = 1
    })
}

module.exports = {
    ChromeWebStoreError,
    compareChromeVersions,
    parseChromeVersion,
    publishChromeWebStore,
    readZipManifestVersion,
    resolveChromeWebStoreConfig
}
