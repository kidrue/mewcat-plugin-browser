import { VisionProviderError } from "@/image-translation/errors"
import type {
    LegacyTranslateImageRequest,
    LegacyTranslateImageResponse
} from "@/messaging/protocol"
import { getCachedTranslation } from "@/translation/PictureCache"

import { resolveAllHotlinkHeaders } from "../config/hotlink-sites"
import { withTemporaryHotlinkRule } from "../lib/hotlink-dnr"

// --- Constants ---

const DOWNLOAD_TIMEOUT_MS = 15_000

function safeCaptureLog(_metadata: {
    capturePath?: FetchPath
    bytes?: number
    status?: number | null
    requestIdSuffix?: string
    cacheHit?: boolean
}): void {
    if (import.meta.env.DEV) {
        void _metadata
    }
}

// --- Helper Functions ---

type FetchPath =
    | "direct-fetch"
    | "anti-hotlink-fetch"
    | "canvas-rebuild-fetch"
    | "screenshot-fallback"
type DownloadFailureType = "http" | "mime" | "network" | "unknown"
type DownloadErrorCode = number | null
type RetryCandidate = {
    referer: string
    origin?: string
    ruleKey: string
    source: "manual" | "generated"
    priority: number
}
type CaptureTarget =
    | {
          kind: "img"
          imageUrl: string
      }
    | {
          kind: "canvas"
          canvasId: string
      }

function isTimeoutError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        ((error as { name?: unknown }).name === "AbortError" ||
            (error as { name?: unknown }).name === "TimeoutError")
    )
}

class DownloadHttpError extends Error {
    status: number

    constructor(status: number, statusText: string) {
        super(`HTTP ${status}: ${statusText}`)
        this.name = "DownloadHttpError"
        this.status = status
    }
}

class DownloadMimeError extends Error {
    mimeType: string

    constructor(mimeType: string) {
        super(`Unsupported MIME type: ${mimeType}`)
        this.name = "DownloadMimeError"
        this.mimeType = mimeType
    }
}

function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit & { timeout: number }
): Promise<Response> {
    const { timeout, ...fetchInit } = init
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    fetchInit.signal = controller.signal
    return fetch(input, fetchInit).finally(() => clearTimeout(timer))
}

/**
 * Primary path: fetch image directly in background (no CORS restrictions).
 * Returns null if MIME type is not a supported image (anti-hotlink 200 with HTML).
 */
async function transcodeImageBlobToPng(inputBlob: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(inputBlob)
    try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            throw new Error("无法创建图片转码 Canvas 上下文")
        }
        ctx.drawImage(bitmap, 0, 0)
        return await canvas.convertToBlob({ type: "image/png" })
    } finally {
        bitmap.close()
    }
}

async function downloadImage(
    imageUrl: string
): Promise<{ blob: Blob; mimeType: string }> {
    const response = await fetchWithTimeout(imageUrl, {
        method: "GET",
        headers: { Accept: "image/*" },
        timeout: DOWNLOAD_TIMEOUT_MS
    })

    if (!response.ok) {
        throw new DownloadHttpError(response.status, response.statusText)
    }

    const blob = await response.blob()
    // Some hotlink responses omit Content-Type; keep a conservative default for API validation.
    const mimeType = blob.type || "image/png"

    if (mimeType === "image/png" || mimeType === "image/jpeg") {
        return { blob, mimeType }
    }

    // Convert WEBP/AVIF/GIF/BMP/... to PNG before sending to API.
    if (mimeType.startsWith("image/")) {
        try {
            const convertedBlob = await transcodeImageBlobToPng(blob)
            return { blob: convertedBlob, mimeType: "image/png" }
        } catch {
            throw new DownloadMimeError(mimeType)
        }
    }

    // Anti-hotlink sites may return 200 with text/html or other non-image MIME
    if (!mimeType.startsWith("image/")) {
        throw new DownloadMimeError(mimeType)
    }
    throw new DownloadMimeError(mimeType)
}

function getDownloadFailureType(error: unknown): DownloadFailureType {
    if (error instanceof DownloadHttpError) {
        return "http"
    }
    if (error instanceof DownloadMimeError) {
        return "mime"
    }
    if (error instanceof TypeError) {
        return "network"
    }
    return "unknown"
}

function getDownloadErrorCode(error: unknown): DownloadErrorCode {
    if (error instanceof DownloadHttpError) {
        return error.status
    }
    return null
}

function shouldAllowScreenshotFallback(error: unknown): boolean {
    if (error instanceof DownloadMimeError) {
        return true
    }
    if (error instanceof DownloadHttpError) {
        return (
            error.status === 401 || error.status === 403 || error.status === 429
        )
    }
    return false
}

function buildAutoPageRetryCandidate(
    imageUrl: string,
    pageUrl?: string
): RetryCandidate | null {
    if (!pageUrl) {
        return null
    }
    try {
        const imageHost = new URL(imageUrl).hostname.toLowerCase()
        const page = new URL(pageUrl)
        const pageHost = page.hostname.toLowerCase()
        const sameHost =
            imageHost === pageHost || imageHost.endsWith(`.${pageHost}`)
        if (!sameHost) {
            return null
        }
        return {
            referer: `${page.origin}/`,
            origin: page.origin,
            ruleKey: "auto-page-origin",
            source: "generated",
            priority: -1
        }
    } catch {
        return null
    }
}

/**
 * Enhanced download path:
 * 1) direct background fetch
 * 2) if needed and site is recognized as anti-hotlink, retry with temporary DNR headers
 */
async function downloadImageWithHotlinkRetry(
    imageUrl: string,
    pageUrl?: string
): Promise<{
    imageData: { blob: Blob; mimeType: string } | null
    path: FetchPath | null
    ruleHit: string | null
    allowScreenshotFallback: boolean
    failureType: DownloadFailureType | null
    errorCode: DownloadErrorCode
    timedOut: boolean
}> {
    let lastError: unknown = null

    try {
        const directData = await downloadImage(imageUrl)
        return {
            imageData: directData,
            path: "direct-fetch",
            ruleHit: null,
            allowScreenshotFallback: false,
            failureType: null,
            errorCode: null,
            timedOut: false
        }
    } catch (error) {
        lastError = error
        safeCaptureLog({ status: getDownloadErrorCode(error) })
    }

    const hotlinkCandidates = resolveAllHotlinkHeaders({ imageUrl, pageUrl })
    const retryCandidates: RetryCandidate[] = [...hotlinkCandidates]
    const autoPageCandidate = buildAutoPageRetryCandidate(imageUrl, pageUrl)
    if (
        autoPageCandidate &&
        !retryCandidates.some(
            candidate =>
                candidate.referer === autoPageCandidate.referer &&
                candidate.origin === autoPageCandidate.origin
        )
    ) {
        retryCandidates.push(autoPageCandidate)
    }

    if (!retryCandidates.length) {
        return {
            imageData: null,
            path: null,
            ruleHit: null,
            allowScreenshotFallback: shouldAllowScreenshotFallback(lastError),
            failureType: getDownloadFailureType(lastError),
            errorCode: getDownloadErrorCode(lastError),
            timedOut: isTimeoutError(lastError)
        }
    }

    for (const candidate of retryCandidates) {
        try {
            const hotlinkData = await withTemporaryHotlinkRule(
                imageUrl,
                {
                    referer: candidate.referer,
                    origin: candidate.origin
                },
                () => downloadImage(imageUrl)
            )

            safeCaptureLog({
                capturePath: "anti-hotlink-fetch",
                bytes: hotlinkData.blob.size
            })
            return {
                imageData: hotlinkData,
                path: "anti-hotlink-fetch",
                ruleHit: candidate.ruleKey,
                allowScreenshotFallback: false,
                failureType: null,
                errorCode: null,
                timedOut: false
            }
        } catch (error) {
            lastError = error
            safeCaptureLog({ status: getDownloadErrorCode(error) })
        }
    }

    return {
        imageData: null,
        path: null,
        ruleHit: null,
        allowScreenshotFallback: shouldAllowScreenshotFallback(lastError),
        failureType: getDownloadFailureType(lastError),
        errorCode: getDownloadErrorCode(lastError),
        timedOut: isTimeoutError(lastError)
    }
}

const EXTENSION_UI_SELECTORS =
    "#mewcat-image-translate, #mewcat-overlay-selection, #translation-control-center-overlay"

/**
 * Fallback path: capture visible tab and crop to image bounds.
 * Scrolls the image into full view before capturing to avoid partial screenshots.
 */
async function captureAndCropTarget(
    tabId: number,
    target: CaptureTarget,
    dpr: number
): Promise<{ blob: Blob; mimeType: string }> {
    const tab = await chrome.tabs.get(tabId)
    const windowId = tab.windowId

    // 1. 隐藏插件 UI + 滚动图片到完全可见 + 获取最新 rect
    const prepResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: (captureTarget: CaptureTarget, selectors: string) => {
            const normalize = (value: string | null | undefined) => {
                if (!value) {
                    return ""
                }
                try {
                    return new URL(value, window.location.href).href
                } catch {
                    return value
                }
            }

            // 隐藏插件 UI
            document.querySelectorAll(selectors).forEach(el => {
                ;(el as HTMLElement).style.display = "none"
            })

            let targetElement: HTMLElement | null = null

            if (captureTarget.kind === "img") {
                const targetSrc = normalize(captureTarget.imageUrl)
                const isSrcMatch = (value: string | null | undefined) =>
                    normalize(value) === targetSrc

                const images = document.querySelectorAll("img")
                for (const img of images) {
                    const srcsetFirst = (img.getAttribute("srcset") || "")
                        .split(",")[0]
                        ?.trim()
                        ?.split(" ")[0]

                    if (
                        isSrcMatch(img.src) ||
                        isSrcMatch(img.currentSrc) ||
                        isSrcMatch(img.getAttribute("data-src")) ||
                        isSrcMatch(img.getAttribute("data-original-src")) ||
                        isSrcMatch(srcsetFirst)
                    ) {
                        targetElement = img
                        break
                    }
                }
            } else {
                const canvases = document.querySelectorAll("canvas")
                for (const canvas of canvases) {
                    if (
                        canvas.getAttribute("data-mewcat-canvas-id") ===
                        captureTarget.canvasId
                    ) {
                        targetElement = canvas
                        break
                    }
                }
            }

            if (!targetElement) {
                return null
            }

            const savedScrollX = window.scrollX
            const savedScrollY = window.scrollY

            // 滚动目标元素到视口中央，确保完全可见
            targetElement.scrollIntoView({ block: "center", inline: "center" })

            // 获取滚动后的最新 rect
            const rect = targetElement.getBoundingClientRect()
            const vv = window.visualViewport
            return {
                rect: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                dpr: window.devicePixelRatio,
                vv: vv
                    ? {
                          offsetLeft: vv.offsetLeft,
                          offsetTop: vv.offsetTop,
                          scale: vv.scale
                      }
                    : null,
                savedScrollX,
                savedScrollY
            }
        },
        args: [target, EXTENSION_UI_SELECTORS]
    })

    const prepData = prepResult?.[0]?.result
    if (!prepData) {
        // 恢复 UI
        await chrome.scripting
            .executeScript({
                target: { tabId },
                func: (selectors: string) => {
                    document.querySelectorAll(selectors).forEach(el => {
                        ;(el as HTMLElement).style.display = ""
                    })
                },
                args: [EXTENSION_UI_SELECTORS]
            })
            .catch(() => {})
        throw new Error("截图兜底失败：未找到目标元素")
    }

    // 巨图本身无法完整出现在单次可视区内，此时截图兜底天然不可靠
    if (
        prepData.rect.width > prepData.viewport.width ||
        prepData.rect.height > prepData.viewport.height
    ) {
        await chrome.scripting
            .executeScript({
                target: { tabId },
                func: (sx: number, sy: number, selectors: string) => {
                    window.scrollTo(sx, sy)
                    document.querySelectorAll(selectors).forEach(el => {
                        ;(el as HTMLElement).style.display = ""
                    })
                },
                args: [
                    prepData.savedScrollX,
                    prepData.savedScrollY,
                    EXTENSION_UI_SELECTORS
                ]
            })
            .catch(() => {})
        throw new Error("截图兜底失败：图片尺寸超过可视区")
    }

    // 2. 等待滚动渲染完成
    await new Promise(resolve => setTimeout(resolve, 150))

    // 3. 截图
    let dataUrl: string
    try {
        dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
            format: "png"
        })
    } finally {
        // 4. 恢复滚动位置 + 显示插件 UI
        await chrome.scripting
            .executeScript({
                target: { tabId },
                func: (sx: number, sy: number, selectors: string) => {
                    window.scrollTo(sx, sy)
                    document.querySelectorAll(selectors).forEach(el => {
                        ;(el as HTMLElement).style.display = ""
                    })
                },
                args: [
                    prepData.savedScrollX,
                    prepData.savedScrollY,
                    EXTENSION_UI_SELECTORS
                ]
            })
            .catch(() => {})
    }

    // 5. 解码截图并裁剪
    const imageRect = prepData.rect
    const actualDpr = prepData.dpr || dpr
    const vv = prepData.vv

    const screenshotResponse = await fetch(dataUrl)
    const screenshotBlob = await screenshotResponse.blob()
    const imageBitmap = await createImageBitmap(screenshotBlob)

    const screenshotWidth = imageBitmap.width
    const screenshotHeight = imageBitmap.height

    const vpOffsetLeft = vv?.offsetLeft ?? 0
    const vpOffsetTop = vv?.offsetTop ?? 0
    const vpScale = vv?.scale ?? 1

    const visualX = (imageRect.left - vpOffsetLeft) * vpScale
    const visualY = (imageRect.top - vpOffsetTop) * vpScale
    const visualW = imageRect.width * vpScale
    const visualH = imageRect.height * vpScale

    const rawX = Math.round(visualX * actualDpr)
    const rawY = Math.round(visualY * actualDpr)
    const rawW = Math.round(visualW * actualDpr)
    const rawH = Math.round(visualH * actualDpr)

    const x1 = Math.max(0, rawX)
    const y1 = Math.max(0, rawY)
    const x2 = Math.min(screenshotWidth, rawX + rawW)
    const y2 = Math.min(screenshotHeight, rawY + rawH)
    const cropW = x2 - x1
    const cropH = y2 - y1

    if (cropW <= 0 || cropH <= 0) {
        imageBitmap.close()
        throw new Error("裁剪区域无效")
    }

    const canvas = new OffscreenCanvas(cropW, cropH)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
        imageBitmap.close()
        throw new Error("无法创建 OffscreenCanvas context")
    }

    ctx.drawImage(imageBitmap, x1, y1, cropW, cropH, 0, 0, cropW, cropH)
    imageBitmap.close()

    const croppedBlob = await canvas.convertToBlob({ type: "image/png" })
    return { blob: croppedBlob, mimeType: "image/png" }
}

export async function captureImageForTranslation(
    request: LegacyTranslateImageRequest,
    sender: chrome.runtime.MessageSender
): Promise<{ blob: Blob; capturePath?: FetchPath }> {
    try {
        const { imageUrl, devicePixelRatio, pageUrl, canvasMeta } = request
        const sourceImageUrl = imageUrl || canvasMeta?.sourceUrl || ""
        let imageData: { blob: Blob; mimeType: string } | null = null
        let fetchPath: FetchPath | null = null
        let downloadResult: {
            imageData: { blob: Blob; mimeType: string } | null
            path: FetchPath | null
            ruleHit: string | null
            allowScreenshotFallback: boolean
            failureType: DownloadFailureType | null
            errorCode: DownloadErrorCode
            timedOut: boolean
        }

        if (sourceImageUrl) {
            downloadResult = await downloadImageWithHotlinkRetry(
                sourceImageUrl,
                pageUrl
            )
        } else {
            downloadResult = {
                imageData: null,
                path: null,
                ruleHit: null,
                allowScreenshotFallback: true,
                failureType: "unknown",
                errorCode: null,
                timedOut: false
            }
        }

        imageData = downloadResult.imageData
        fetchPath = downloadResult.path
        if (!imageData) {
            if (downloadResult.timedOut) {
                throw new VisionProviderError(
                    "REQUEST_TIMEOUT",
                    "图片抓取超时，请稍后重试。"
                )
            }
            const allowScreenshotFallback =
                downloadResult.allowScreenshotFallback || !!canvasMeta?.canvasId
            if (!allowScreenshotFallback) {
                throw new Error("图片下载失败，且不满足截图兜底条件")
            }
            const senderTabId = sender.tab?.id
            const captureTarget: CaptureTarget | null = canvasMeta?.canvasId
                ? { kind: "canvas", canvasId: canvasMeta.canvasId }
                : sourceImageUrl
                  ? { kind: "img", imageUrl: sourceImageUrl }
                  : null
            if (senderTabId && devicePixelRatio && captureTarget) {
                imageData = await captureAndCropTarget(
                    senderTabId,
                    captureTarget,
                    devicePixelRatio
                )
                fetchPath = "screenshot-fallback"
            } else {
                throw new Error("图片下载失败，且无法使用截图方式")
            }
        }

        if (canvasMeta && fetchPath && fetchPath !== "screenshot-fallback") {
            fetchPath = "canvas-rebuild-fetch"
        }
        return { blob: imageData.blob, capturePath: fetchPath ?? undefined }
    } catch (error) {
        if (error instanceof VisionProviderError) {
            throw error
        }
        if (
            typeof error === "object" &&
            error !== null &&
            ((error as { name?: unknown }).name === "AbortError" ||
                (error as { name?: unknown }).name === "TimeoutError")
        ) {
            throw new VisionProviderError(
                "REQUEST_TIMEOUT",
                "图片抓取超时，请稍后重试。"
            )
        }
        throw new VisionProviderError(
            "UNSUPPORTED_IMAGE",
            "无法处理该图片，请使用有效且不超过 10 MiB 的图片。"
        )
    }
}

// --- Main Handler ---

export async function handleTranslateImage(
    request: LegacyTranslateImageRequest,
    sender: chrome.runtime.MessageSender
): Promise<LegacyTranslateImageResponse> {
    try {
        const { targetLanguage } = request
        if (!targetLanguage) {
            return { success: false, error: "缺少必要参数" }
        }
        const captured = await captureImageForTranslation(request, sender)

        // Step 2: Check cache first
        const sourceLang = "auto" // 默认自动检测源语言
        const cachedUrl = await getCachedTranslation(
            captured.blob,
            sourceLang,
            targetLanguage
        )

        let translatedImageUrl: string

        if (cachedUrl) {
            safeCaptureLog({
                requestIdSuffix: request.requestId?.slice(-6),
                cacheHit: true
            })
            translatedImageUrl = cachedUrl
        } else {
            // Image translation via third-party API is not yet implemented.
            throw new Error("图片翻译功能暂不可用，请等待后续版本支持")
        }

        const successResponse: LegacyTranslateImageResponse = {
            success: true,
            translatedImageUrl
        }
        sendBackupResponse(sender, request, successResponse)
        return successResponse
    } catch (error) {
        void error
        const errorResponse: LegacyTranslateImageResponse = {
            success: false,
            error: error instanceof Error ? error.message : "图片翻译失败"
        }
        sendBackupResponse(sender, request, errorResponse)
        return errorResponse
    }
}

/**
 * Backup response channels to ensure the content script receives the result
 * even when the primary response channel breaks (HMR / MV3 edge cases).
 *
 * Channel 1: chrome.tabs.sendMessage — independent message to the tab
 * Channel 2: chrome.storage.local — completely bypasses messaging
 */
function sendBackupResponse(
    sender: chrome.runtime.MessageSender,
    request: LegacyTranslateImageRequest,
    response: LegacyTranslateImageResponse
) {
    const tabId = sender.tab?.id
    const requestId = request.requestId
    if (!requestId) {
        return
    }

    // Storage channel: most reliable, no messaging dependency
    const storageKey = `__tr_result_${requestId}`
    chrome.storage.local.set({ [storageKey]: response }).catch(() => {})

    // Tab message channel
    if (tabId) {
        chrome.tabs
            .sendMessage(tabId, {
                type: "__translate_image_result__",
                requestId,
                response
            })
            .catch(() => {})
    }
}

export type { LegacyTranslateImageRequest, LegacyTranslateImageResponse }
