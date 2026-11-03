import { describe, expect, it } from "vitest"

import { AiRoleSystemPrompts } from "../src/constants/aiRole"
import { defaultExtensionConfig } from "../src/state/constants"
import {
    translateBatch,
    translateText
} from "../src/translation/translationService"
import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"
import { AiRole } from "../src/types/config"
import { repairExtensionConfig } from "../src/types/extensionConfigSchema"

const model: BaseModel = {
    id: "test-ai",
    type: AiModel_Platform_Enum.OPENAI,
    enabled: true,
    name: "Test AI",
    params: { apiKey: "test-key", modelName: "test-model", isOfficial: true }
}

describe("automatic AI role translation", () => {
    it("defaults off, repairs invalid switches and preserves a saved opt-in", () => {
        expect(defaultExtensionConfig.enableAutoAiRole).toBe(false)
        for (const stored of [undefined, "true", false, true]) {
            const config = repairExtensionConfig(
                { ...defaultExtensionConfig, enableAutoAiRole: stored },
                defaultExtensionConfig
            )
            expect(config.enableAutoAiRole).toBe(stored === true)
        }
    })

    it.each([translateText, translateBatch])(
        "uses the resolved role in model instructions",
        async translate => {
            const config = {
                ...defaultExtensionConfig,
                currentModel: model.id,
                aiModelList: [model],
                aiRole: AiRole.FREE_TRANSLATOR,
                enableAutoAiRole: true
            }
            for (const [title, role] of [
                ["Machine learning", AiRole.AI_TRANSLATOR],
                ["Cognitive psychology", AiRole.PSYCHOLOGY_TRANSLATOR],
                ["Welcome", AiRole.FREE_TRANSLATOR]
            ] as const) {
                const result = await translate(
                    config,
                    [{ role: "user", content: "Hello" }],
                    "zh-CN",
                    {
                        pageContext: { url: "https://example.com", title }
                    },
                    {
                        modelGatewaySender: async request => {
                            if (request.type !== "generate")
                                throw new Error("Expected generate")
                            expect(request.messages[0].content).toContain(
                                AiRoleSystemPrompts[role]
                            )
                            return { success: true, text: "你好" }
                        }
                    }
                )
                expect(result).toBe("你好")
                expect(config.aiRole).toBe(AiRole.FREE_TRANSLATOR)
            }
        }
    )

    it("keeps the manually selected role when the switch is off", async () => {
        await translateText(
            {
                ...defaultExtensionConfig,
                currentModel: model.id,
                aiModelList: [model],
                aiRole: AiRole.NORTHEAST_DIALECT
            },
            [{ role: "user", content: "Hello" }],
            "zh-CN",
            {
                pageContext: { url: "https://github.com/org/repo" }
            },
            {
                modelGatewaySender: async request => {
                    if (request.type !== "generate")
                        throw new Error("Expected generate")
                    expect(request.messages[0].content).toContain(
                        AiRoleSystemPrompts[AiRole.NORTHEAST_DIALECT]
                    )
                    return { success: true, text: "你好" }
                }
            }
        )
    })
})
