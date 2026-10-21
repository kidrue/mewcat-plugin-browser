import type { ImageTranslationBlock } from "../messaging/protocol"
import type { VisionTranslationBlock } from "./types"

const MAX_SAMPLES_PER_REGION = 64
const FALLBACK_RGB = [128, 128, 128] as const

export interface VisionPixelBuffer {
    width: number
    height: number
    read(
        x: number,
        y: number,
        width: number,
        height: number,
        maxSamples: number
    ): Uint8ClampedArray | null
}

const toColor = ([red, green, blue]: readonly number[]) =>
    `rgba(${red}, ${green}, ${blue}, 0.92)`

function relativeLuminance([red, green, blue]: readonly number[]): number {
    const linear = [red, green, blue].map(channel => {
        const value = channel / 255
        return value <= 0.03928
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function readableTextColor(rgb: readonly number[]): "#000000" | "#ffffff" {
    const luminance = relativeLuminance(rgb)
    const blackContrast = (luminance + 0.05) / 0.05
    const whiteContrast = 1.05 / (luminance + 0.05)
    return blackContrast >= whiteContrast ? "#000000" : "#ffffff"
}

function mapRegion(
    box: VisionTranslationBlock["box"],
    width: number,
    height: number
) {
    const [ymin, xmin, ymax, xmax] = box
    if (width <= 0 || height <= 0 || ymax <= ymin || xmax <= xmin) {
        return null
    }
    const left = Math.max(
        0,
        Math.min(width - 1, Math.floor((xmin / 1000) * width))
    )
    const top = Math.max(
        0,
        Math.min(height - 1, Math.floor((ymin / 1000) * height))
    )
    const right = Math.max(
        left + 1,
        Math.min(width, Math.ceil((xmax / 1000) * width))
    )
    const bottom = Math.max(
        top + 1,
        Math.min(height, Math.ceil((ymax / 1000) * height))
    )
    return { x: left, y: top, width: right - left, height: bottom - top }
}

function representativeColor(
    buffer: VisionPixelBuffer | null,
    block: VisionTranslationBlock
): readonly [number, number, number] {
    const region = buffer && mapRegion(block.box, buffer.width, buffer.height)
    if (!region) {
        return FALLBACK_RGB
    }
    try {
        const pixels = buffer.read(
            region.x,
            region.y,
            region.width,
            region.height,
            MAX_SAMPLES_PER_REGION
        )
        if (!pixels || pixels.length < 4) {
            return FALLBACK_RGB
        }
        const pixelCount = Math.floor(pixels.length / 4)
        const step = Math.max(1, Math.ceil(pixelCount / MAX_SAMPLES_PER_REGION))
        let count = 0
        let red = 0
        let green = 0
        let blue = 0
        for (let index = 0; index < pixelCount; index += step) {
            const offset = index * 4
            if (pixels[offset + 3] === 0) {
                continue
            }
            red += pixels[offset]
            green += pixels[offset + 1]
            blue += pixels[offset + 2]
            count += 1
        }
        if (count === 0) {
            return FALLBACK_RGB
        }
        return [
            Math.round(red / count),
            Math.round(green / count),
            Math.round(blue / count)
        ]
    } catch {
        return FALLBACK_RGB
    }
}

export function decorateBlocksWithColors(
    blocks: VisionTranslationBlock[],
    pixels: VisionPixelBuffer | null
): ImageTranslationBlock[] {
    return blocks.map(block => {
        const rgb = representativeColor(pixels, block)
        return {
            ...block,
            box: [...block.box] as ImageTranslationBlock["box"],
            backgroundColor: toColor(rgb),
            textColor: readableTextColor(rgb)
        }
    })
}
