import { describe, expect, it } from "vitest"

import {
    createStrictImageTranslationUnavailableResponse,
    isEmptyTranslateImageSuccessResponse,
    isLegacyTranslateImageRequest,
    isTranslateImageRequest,
    isTranslateImageResponse,
    parseNormalizedImageBox
} from "../src/messaging/imageTranslationContracts"

const result = {
    sourceWidth: 1200,
    sourceHeight: 800,
    modelId: "gemini-2.5-flash",
    cacheHit: false,
    blocks: [
        {
            box: [0, 10, 200, 300],
            sourceText: "Hello",
            translatedText: "你好",
            writingMode: "horizontal",
            backgroundColor: "#ffffff",
            textColor: "#000000"
        }
    ]
}

const emptyResult = {
    sourceWidth: 1200,
    sourceHeight: 800,
    modelId: "gemini-2.5-flash",
    cacheHit: false,
    blocks: []
}

describe("image translation contracts", () => {
    it("accepts only normalized integer coordinate tuples", () => {
        expect(parseNormalizedImageBox([0, 10, 999, 1000])).toEqual([
            0, 10, 999, 1000
        ])
        expect(() => parseNormalizedImageBox([0.5, 10, 999, 1000])).toThrow()
        expect(() => parseNormalizedImageBox([-1, 10, 999, 1000])).toThrow()
        expect(() => parseNormalizedImageBox([0, 10, 999, 1001])).toThrow()
    })

    it("requires a model ID and validates strict success and failure payloads", () => {
        expect(
            isTranslateImageRequest({
                imageUrl: "https://example.test/image.png",
                targetLanguage: "zh-CN",
                modelId: "gemini-2.5-flash"
            })
        ).toBe(true)
        expect(
            isTranslateImageRequest({
                imageUrl: "https://example.test/image.png",
                targetLanguage: "zh-CN"
            })
        ).toBe(false)

        expect(isTranslateImageResponse({ success: true, result })).toBe(true)
        expect(isTranslateImageResponse({ success: true })).toBe(false)
        expect(
            isTranslateImageResponse({
                success: false,
                errorCode: "MODEL_NOT_FOUND",
                message: "未找到模型"
            })
        ).toBe(true)
        expect(
            isTranslateImageResponse({
                success: false,
                errorCode: "MODEL_NOT_FOUND"
            })
        ).toBe(false)
    })

    it.each([
        ["NaN width", { sourceWidth: Number.NaN }],
        ["infinite width", { sourceWidth: Number.POSITIVE_INFINITY }],
        ["zero width", { sourceWidth: 0 }],
        ["negative width", { sourceWidth: -1 }],
        ["NaN height", { sourceHeight: Number.NaN }],
        ["infinite height", { sourceHeight: Number.NEGATIVE_INFINITY }],
        ["zero height", { sourceHeight: 0 }],
        ["negative height", { sourceHeight: -1 }]
    ])("rejects strict success with %s", (_label, changedFields) => {
        expect(
            isTranslateImageResponse({
                success: true,
                result: { ...emptyResult, ...changedFields }
            })
        ).toBe(false)
    })

    it.each([
        ["model ID", { modelId: " \t " }],
        ["source text", { blocks: [{ ...result.blocks[0], sourceText: " " }] }],
        [
            "translated text",
            { blocks: [{ ...result.blocks[0], translatedText: "\n" }] }
        ],
        [
            "background color",
            { blocks: [{ ...result.blocks[0], backgroundColor: "  " }] }
        ],
        ["text color", { blocks: [{ ...result.blocks[0], textColor: "\t" }] }]
    ])("rejects strict success with blank %s", (_label, changedFields) => {
        expect(
            isTranslateImageResponse({
                success: true,
                result: { ...result, ...changedFields }
            })
        ).toBe(false)
    })

    it.each([
        ["zero height", [100, 200, 100, 300]],
        ["zero width", [100, 200, 300, 200]],
        ["reversed vertical coordinates", [300, 200, 100, 400]],
        ["reversed horizontal coordinates", [100, 400, 300, 200]]
    ])("rejects strict success with a %s box", (_label, box) => {
        expect(
            isTranslateImageResponse({
                success: true,
                result: {
                    ...result,
                    blocks: [{ ...result.blocks[0], box }]
                }
            })
        ).toBe(false)
    })

    it("rejects an empty strict success while recognizing its stable NO_TEXT shape", () => {
        expect(
            isTranslateImageResponse({ success: true, result: emptyResult })
        ).toBe(false)
        expect(
            isEmptyTranslateImageSuccessResponse({
                success: true,
                result: emptyResult
            })
        ).toBe(true)
        expect(
            isEmptyTranslateImageSuccessResponse({
                success: true,
                result: { ...emptyResult, sourceWidth: Number.NaN }
            })
        ).toBe(false)
    })

    it("keeps legacy requests separate and rejects strict requests without invoking legacy output", () => {
        const legacyRequest = {
            imageUrl: "https://example.test/image.png",
            targetLanguage: "zh-CN"
        }

        expect(isLegacyTranslateImageRequest(legacyRequest)).toBe(true)
        expect(isTranslateImageRequest(legacyRequest)).toBe(false)
        expect(
            createStrictImageTranslationUnavailableResponse(legacyRequest)
        ).toEqual({
            success: false,
            errorCode: "INVALID_REQUEST",
            message: "图片翻译请求缺少有效的视觉模型 ID"
        })
        expect(
            createStrictImageTranslationUnavailableResponse({
                ...legacyRequest,
                modelId: "gemini-2.5-flash"
            })
        ).toEqual({
            success: false,
            errorCode: "TRANSLATION_FAILED",
            message: "结构化图片翻译尚未实现"
        })
    })
})
