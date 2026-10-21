import { z } from "zod"

import type {
    ImageTextWritingMode,
    NormalizedImageBox
} from "../messaging/protocol"
import { VisionProviderError } from "./errors"
import type { PreparedVisionImage, VisionTranslationResult } from "./types"

const semanticBlockSchema = z
    .object({
        box: z.tuple([
            z.number().finite(),
            z.number().finite(),
            z.number().finite(),
            z.number().finite()
        ]),
        sourceText: z.string(),
        translatedText: z.string(),
        writingMode: z.enum(["horizontal", "vertical"])
    })
    .strict()

export const visionTranslationSchema = z
    .object({ blocks: z.array(semanticBlockSchema) })
    .strict()

const stripJsonFence = (value: string): string => {
    const match = value.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    return match?.[1] ?? value.trim()
}

const normalizeCoordinate = (coordinate: number): number =>
    Math.min(1000, Math.max(0, Math.round(coordinate)))

const parseValue = (value: unknown): unknown => {
    if (typeof value !== "string") return value
    try {
        return JSON.parse(stripJsonFence(value))
    } catch {
        throw new VisionProviderError(
            "MALFORMED_PROVIDER_RESPONSE",
            "视觉模型返回的结构化结果无法解析"
        )
    }
}

export function parseVisionResponse(
    response: unknown,
    image: PreparedVisionImage
): VisionTranslationResult {
    const parsedValue = parseValue(response)
    const validation = visionTranslationSchema.safeParse(parsedValue)
    if (!validation.success) {
        throw new VisionProviderError(
            "MALFORMED_PROVIDER_RESPONSE",
            "视觉模型返回的结构化结果格式无效"
        )
    }

    const blocks = validation.data.blocks.flatMap(block => {
        const [ymin, xmin, ymax, xmax] = block.box.map(normalizeCoordinate) as [
            number,
            number,
            number,
            number
        ]
        const sourceText = block.sourceText.trim()
        const translatedText = block.translatedText.trim()
        if (!sourceText || !translatedText || ymin >= ymax || xmin >= xmax) {
            return []
        }
        return [
            {
                box: [ymin, xmin, ymax, xmax] as NormalizedImageBox,
                sourceText,
                translatedText,
                writingMode: block.writingMode as ImageTextWritingMode
            }
        ]
    })

    return {
        sourceWidth: image.sourceWidth,
        sourceHeight: image.sourceHeight,
        blocks
    }
}
