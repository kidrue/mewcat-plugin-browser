import { VisionProviderError } from "./errors"
import type { PreparedVisionImage } from "./types"

export const MAX_VISION_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_VISION_IMAGE_EDGE = 2048
export const WEBP_QUALITY = 0.92

const supportedImageTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif"
])

export interface DecodedVisionBitmap {
    width: number
    height: number
    close(): void
}

export interface VisionImageCodec {
    decode(blob: Blob): Promise<DecodedVisionBitmap>
    encodeWebp(
        bitmap: DecodedVisionBitmap,
        width: number,
        height: number,
        quality: number
    ): Promise<Blob>
}

function unsupportedImageError(): VisionProviderError {
    return new VisionProviderError(
        "UNSUPPORTED_IMAGE",
        "无法处理该图片，请使用有效且不超过 10 MiB 的图片。"
    )
}

export function resizeDimensions(
    width: number,
    height: number
): { width: number; height: number } {
    if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0
    ) {
        throw unsupportedImageError()
    }

    const longEdge = Math.max(width, height)
    if (longEdge <= MAX_VISION_IMAGE_EDGE) {
        return { width, height }
    }

    const scale = MAX_VISION_IMAGE_EDGE / longEdge
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    }
}

export async function base64FromBlob(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ""
    const chunkSize = 0x8000
    for (let start = 0; start < bytes.length; start += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(start, start + chunkSize)
        )
    }
    return btoa(binary)
}

export async function sha256Blob(blob: Blob): Promise<string> {
    try {
        const hash = await crypto.subtle.digest(
            "SHA-256",
            await blob.arrayBuffer()
        )
        return Array.from(new Uint8Array(hash), byte =>
            byte.toString(16).padStart(2, "0")
        ).join("")
    } catch {
        throw unsupportedImageError()
    }
}

const browserVisionImageCodec: VisionImageCodec = {
    async decode(blob) {
        if (typeof createImageBitmap !== "function") {
            throw unsupportedImageError()
        }
        const bitmap = await createImageBitmap(blob)
        return bitmap
    },
    async encodeWebp(bitmap, width, height, quality) {
        if (typeof OffscreenCanvas === "undefined") {
            throw unsupportedImageError()
        }
        const canvas = new OffscreenCanvas(width, height)
        const context = canvas.getContext("2d")
        if (!context) {
            throw unsupportedImageError()
        }
        context.drawImage(bitmap as ImageBitmap, 0, 0, width, height)
        return canvas.convertToBlob({ type: "image/webp", quality })
    }
}

export async function prepareVisionImage(
    source: Blob,
    targetLanguage: string,
    codec: VisionImageCodec = browserVisionImageCodec
): Promise<PreparedVisionImage> {
    if (source.size > MAX_VISION_IMAGE_BYTES) {
        throw unsupportedImageError()
    }

    let bitmap: DecodedVisionBitmap | undefined
    try {
        bitmap = await codec.decode(source)
        const { width: preparedWidth, height: preparedHeight } =
            resizeDimensions(bitmap.width, bitmap.height)
        const needsEncoding =
            preparedWidth !== bitmap.width ||
            preparedHeight !== bitmap.height ||
            !supportedImageTypes.has(source.type.toLowerCase())
        const preparedBlob = needsEncoding
            ? await codec.encodeWebp(
                  bitmap,
                  preparedWidth,
                  preparedHeight,
                  WEBP_QUALITY
              )
            : source
        const [base64, originalHash] = await Promise.all([
            base64FromBlob(preparedBlob),
            sha256Blob(source)
        ])
        return {
            mimeType: needsEncoding ? "image/webp" : source.type,
            base64,
            targetLanguage,
            sourceWidth: bitmap.width,
            sourceHeight: bitmap.height,
            preparedWidth,
            preparedHeight,
            originalHash
        }
    } catch (error) {
        if (error instanceof VisionProviderError) {
            throw error
        }
        throw unsupportedImageError()
    } finally {
        bitmap?.close()
    }
}
