import { describe, expect, it, vi } from "vitest"

import { handleModelGatewayRequest } from "../src/background/messages/model-gateway"
import { discoverModels } from "../src/features/model-management/discovery"
import { defaultExtensionConfig } from "../src/state/constants"
import { normalizeStoredConfig } from "../src/state/translationService"
import { translateBatch } from "../src/features/translation-services/translationService"
import { AiModel_Platform_Enum, type BaseModel } from "../src/types/aiModel"
import { selectPageSummaryModel } from "../src/features/page-summary/availability"

const modelId = "Pro/deepseek-ai/DeepSeek-V4-Flash"
const connection = {
    provider: AiModel_Platform_Enum.SILICONFLOW,
    apiKey: "test-key",
    isOfficial: true
}

describe("SiliconFlow client provider", () => {
    it.each([{ ids: [modelId] }, { ids: [] }])(
        "discovers only chat models and preserves model IDs ($ids)",
        async ({ ids }) => {
            const fetchImpl = vi.fn<typeof fetch>(async () =>
                Response.json({ data: ids.map(id => ({ id })) })
            )
            const signal = new AbortController().signal
            const result = await discoverModels(
                connection,
                { fetchImpl },
                signal
            )

            expect(result.map(model => model.id)).toEqual(ids)
            expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
                "https://api.siliconflow.cn/v1/models?sub_type=chat",
                expect.objectContaining({
                    headers: { Authorization: "Bearer test-key" },
                    signal
                })
            )
        }
    )

    it.each([
        [401, "AUTHENTICATION_FAILED"],
        [403, "AUTHENTICATION_FAILED"],
        [429, "NETWORK_FAILURE"]
    ])(
        "returns a discovery error without substituting a catalog on HTTP %s",
        async (status, code) => {
            const fetchImpl = vi.fn<typeof fetch>(
                async () => new Response(null, { status })
            )
            await expect(
                discoverModels(connection, { fetchImpl })
            ).rejects.toMatchObject({ code })
            expect(fetchImpl).toHaveBeenCalledOnce()
        }
    )

    it("uses generic model discovery for a custom endpoint", async () => {
        const proxyModelId = "models/gateway/text"
        const listOpenAiModels = vi.fn(async () => [{ id: proxyModelId }])
        const result = await discoverModels(
            {
                ...connection,
                isOfficial: false,
                baseUrl: "https://example.test/v1"
            },
            { listOpenAiModels, loadCatalog: async () => [] }
        )

        expect(result[0]?.id).toBe(proxyModelId)
        expect(listOpenAiModels).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                baseURL: "https://example.test/v1/",
                apiKey: "test-key"
            })
        )
    })

    it.each(["disabled", "deleted", "rejected"])(
        "never switches providers when the selected service is %s",
        async state => {
            const selected: BaseModel = {
                id: "siliconflow-service",
                type: connection.provider,
                enabled: state !== "disabled",
                name: "硅基流动",
                params: { apiKey: connection.apiKey, modelName: modelId }
            }
            const alternative: BaseModel = {
                ...selected,
                id: "alternative",
                type: AiModel_Platform_Enum.OPENAI,
                enabled: true
            }
            const config = {
                ...defaultExtensionConfig,
                currentModel: selected.id,
                aiModelList:
                    state === "deleted"
                        ? [alternative]
                        : [alternative, selected]
            }
            const mockFetch = vi
                .spyOn(globalThis, "fetch")
                .mockImplementation(
                    async () => new Response(null, { status: 401 })
                )
            try {
                const recordedRequests = vi.fn(handleModelGatewayRequest)
                const translation = translateBatch(
                    config,
                    [{ role: "user", content: "Example" }],
                    "zh-CN",
                    {},
                    { modelGatewaySender: recordedRequests }
                )
                if (state === "rejected") {
                    expect(selectPageSummaryModel(config)?.id).toBe(selected.id)
                    await expect(translation).rejects.toMatchObject({
                        code: "AUTHENTICATION_FAILED",
                        status: 401
                    })
                    expect(recordedRequests).toHaveBeenCalledOnce()
                    expect(mockFetch).toHaveBeenCalledOnce()
                    expect(String(mockFetch.mock.calls[0][0])).toBe(
                        "https://api.siliconflow.cn/v1/chat/completions"
                    )
                } else {
                    expect(selectPageSummaryModel(config)).toBeNull()
                    await expect(translation).rejects.toThrow(
                        "没有对应的翻译服务"
                    )
                    expect(recordedRequests).not.toHaveBeenCalled()
                    expect(mockFetch).not.toHaveBeenCalled()
                }
            } finally {
                mockFetch.mockRestore()
            }
        }
    )

    it.each([
        [true, "https://api.siliconflow.cn/v1/chat/completions"],
        [false, "https://example.test/v1/chat/completions"]
    ])(
        "uses the same saved endpoint and model for translation and summary (official: %s)",
        async (isOfficial, endpoint) => {
            const model: BaseModel = {
                id: "siliconflow-service",
                type: connection.provider,
                enabled: true,
                name: "硅基流动",
                params: {
                    apiKey: connection.apiKey,
                    modelName: modelId,
                    isOfficial,
                    baseUrl: "https://example.test/v1"
                }
            }
            const config = normalizeStoredConfig(
                {
                    ...defaultExtensionConfig,
                    currentModel: model.id,
                    aiModelList: [model]
                },
                defaultExtensionConfig
            )
            expect(config.aiModelList).toEqual([model])

            const mockFetch = vi
                .spyOn(globalThis, "fetch")
                .mockImplementation(async () =>
                    Response.json({
                        choices: [
                            {
                                message: {
                                    role: "assistant",
                                    content: "示例结果"
                                },
                                finish_reason: "stop"
                            }
                        ]
                    })
                )
            try {
                const recordUsage = async () => {}
                await expect(
                    translateBatch(
                        config,
                        [{ role: "user", content: "Example" }],
                        "zh-CN",
                        {},
                        {
                            modelGatewaySender: request =>
                                handleModelGatewayRequest(request, {
                                    recordUsage
                                })
                        }
                    )
                ).resolves.toBe("示例结果")

                const summaryModel = selectPageSummaryModel(config)
                expect(summaryModel).toBeTruthy()
                await expect(
                    handleModelGatewayRequest(
                        {
                            type: "generate",
                            feature: "page-summary",
                            model: summaryModel!,
                            messages: [
                                { role: "user", content: "Summarize the page." }
                            ]
                        },
                        { recordUsage }
                    )
                ).resolves.toMatchObject({ success: true, text: "示例结果" })

                expect(mockFetch).toHaveBeenCalledTimes(2)
                for (const [url, init] of mockFetch.mock.calls) {
                    expect(String(url)).toBe(endpoint)
                    expect(init?.method).toBe("POST")
                    expect(
                        new Headers(init?.headers).get("Authorization")
                    ).toBe("Bearer test-key")
                    expect(JSON.parse(String(init?.body))).toMatchObject({
                        model: modelId
                    })
                }
            } finally {
                mockFetch.mockRestore()
            }
        }
    )
})
