import { describe, expect, it } from "vitest"

import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"
import {
    getImageTranslationConfigRepair,
    getVisionModelOptions,
    isImageTranslationEnabled,
    isVisionCapableModel,
    normalizeImageTranslationModelSelection
} from "../src/utils/visionModels"

const createModel = (
    id: string,
    type: AiModel_Platform_Enum,
    modelName: string,
    options: {
        apiKey?: string
        enabled?: boolean
        isOfficial?: boolean
        vision?: boolean
    } = {}
): BaseModel => ({
    id,
    type,
    enabled: options.enabled ?? true,
    name: `${id} label`,
    params: {
        modelName,
        apiKey: options.apiKey ?? "configured-api-key",
        isOfficial: options.isOfficial
    },
    capabilities:
        options.vision === undefined ? undefined : { vision: options.vision }
})

describe("vision model capabilities", () => {
    it("returns the persisted disable repair without changing text selection", () => {
        const config = {
            enableImageTranslateButton: true,
            imageTranslationModelId: "missing",
            aiModelList: [
                createModel("vision", AiModel_Platform_Enum.OPENAI, "gpt-5", {
                    isOfficial: true
                })
            ],
            currentModel: "text-model"
        }

        expect(getImageTranslationConfigRepair(config)).toEqual({
            enableImageTranslateButton: false
        })
        expect(config.currentModel).toBe("text-model")
    })

    it("does not request a persisted repair for a usable enabled selection", () => {
        expect(
            getImageTranslationConfigRepair({
                enableImageTranslateButton: true,
                imageTranslationModelId: "vision",
                aiModelList: [
                    createModel(
                        "vision",
                        AiModel_Platform_Enum.OPENAI,
                        "gpt-5",
                        { isOfficial: true }
                    )
                ]
            })
        ).toBeNull()
    })

    it.each([
        [
            "blank",
            "",
            [
                createModel("vision", AiModel_Platform_Enum.OPENAI, "gpt-5", {
                    isOfficial: true
                })
            ]
        ],
        [
            "missing",
            "missing",
            [
                createModel("vision", AiModel_Platform_Enum.OPENAI, "gpt-5", {
                    isOfficial: true
                })
            ]
        ],
        [
            "disabled",
            "vision",
            [
                createModel("vision", AiModel_Platform_Enum.OPENAI, "gpt-5", {
                    enabled: false,
                    isOfficial: true
                })
            ]
        ],
        [
            "missing key",
            "vision",
            [
                createModel("vision", AiModel_Platform_Enum.OPENAI, "gpt-5", {
                    apiKey: " ",
                    isOfficial: true
                })
            ]
        ],
        [
            "non-visual",
            "vision",
            [
                createModel(
                    "vision",
                    AiModel_Platform_Enum.DEEPSEEK,
                    "deepseek-chat"
                )
            ]
        ]
    ])(
        "disables image translation for a %s model selection",
        (_, id, models) => {
            expect(
                isImageTranslationEnabled({
                    enableImageTranslateButton: true,
                    imageTranslationModelId: id,
                    aiModelList: models
                })
            ).toBe(false)
        }
    )

    it("keeps image translation enabled for a selected usable vision model", () => {
        expect(
            isImageTranslationEnabled({
                enableImageTranslateButton: true,
                imageTranslationModelId: "vision",
                aiModelList: [
                    createModel(
                        "vision",
                        AiModel_Platform_Enum.OPENAI,
                        "gpt-5",
                        { isOfficial: true }
                    )
                ]
            })
        ).toBe(true)
    })

    it("infers built-in vision support and lets explicit capability override it", () => {
        expect(
            isVisionCapableModel(
                createModel(
                    "gemini",
                    AiModel_Platform_Enum.GEMINI,
                    "gemini-2.5-flash"
                )
            )
        ).toBe(true)
        expect(
            isVisionCapableModel(
                createModel("openai", AiModel_Platform_Enum.OPENAI, "gpt-5", {
                    isOfficial: true
                })
            )
        ).toBe(true)
        expect(
            isVisionCapableModel(
                createModel(
                    "custom-openai",
                    AiModel_Platform_Enum.OPENAI,
                    "custom-model",
                    { isOfficial: true }
                )
            )
        ).toBe(false)
        expect(
            isVisionCapableModel(
                createModel(
                    "zhipu",
                    AiModel_Platform_Enum.ZHIPU,
                    "glm-4v-flash"
                )
            )
        ).toBe(true)
        expect(
            isVisionCapableModel(
                createModel(
                    "huoshan",
                    AiModel_Platform_Enum.HUOSHAN,
                    "doubao-vision-pro"
                )
            )
        ).toBe(true)
        expect(
            isVisionCapableModel(
                createModel(
                    "forced-off",
                    AiModel_Platform_Enum.GEMINI,
                    "gemini-2.5-flash",
                    { vision: false }
                )
            )
        ).toBe(false)
        expect(
            isVisionCapableModel(
                createModel(
                    "forced-on",
                    AiModel_Platform_Enum.DEEPSEEK,
                    "deepseek-chat",
                    { vision: true }
                )
            )
        ).toBe(true)
    })

    it("lists only usable vision models and normalizes only the image model selection", () => {
        const usable = createModel(
            "usable",
            AiModel_Platform_Enum.GEMINI,
            "gemini-2.5-flash"
        )
        const secondUsable = createModel(
            "second-usable",
            AiModel_Platform_Enum.ZHIPU,
            "glm-4v-plus"
        )
        const models = [
            createModel(
                "disabled",
                AiModel_Platform_Enum.GEMINI,
                "gemini-2.5-flash",
                { enabled: false }
            ),
            createModel(
                "missing-key",
                AiModel_Platform_Enum.GEMINI,
                "gemini-2.5-flash",
                { apiKey: "  " }
            ),
            createModel(
                "text-only",
                AiModel_Platform_Enum.DEEPSEEK,
                "deepseek-chat"
            ),
            usable,
            secondUsable
        ]

        expect(getVisionModelOptions(models)).toEqual([
            { label: "usable label", value: "usable" },
            { label: "second-usable label", value: "second-usable" }
        ])
        expect(
            normalizeImageTranslationModelSelection("second-usable", models)
        ).toBe("second-usable")
        expect(
            normalizeImageTranslationModelSelection("text-only", models)
        ).toBe("usable")
        expect(normalizeImageTranslationModelSelection("missing", [])).toBe("")
    })
})
