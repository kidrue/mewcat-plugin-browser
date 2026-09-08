import { handleModelGatewayRequest } from "@/background/messages/model-gateway"
import type {
    ModelGatewayGenerateVisionRequest,
    ModelGatewayResponse
} from "@/messaging/modelGatewayContracts"
import { isTokenPlanEndpoint } from "@/model-management/providers"
import type { BaseModel } from "@/types/aiModel"

import { VisionProviderError } from "./errors"
import { parseVisionResponse } from "./schema"
import type { PreparedVisionImage, VisionTranslationResult } from "./types"

export type VisionGatewaySender = (
    request: ModelGatewayGenerateVisionRequest
) => Promise<ModelGatewayResponse>

const sendToModelGateway: VisionGatewaySender = request =>
    handleModelGatewayRequest(request)

const isTokenPlanModel = (model: BaseModel): boolean => {
    try {
        return isTokenPlanEndpoint({
            provider: model.type,
            isOfficial: model.params.isOfficial !== false,
            customBaseUrl: model.params.baseUrl,
            officialEndpointId: model.params.officialEndpointId
        })
    } catch {
        return false
    }
}

const mapGatewayFailure = (
    response: Extract<ModelGatewayResponse, { success: false }>,
    model: BaseModel
): VisionProviderError => {
    const tokenPlan = isTokenPlanModel(model)
    switch (response.error.code) {
        case "AUTHENTICATION_FAILED":
            return new VisionProviderError(
                "AUTHENTICATION_FAILED",
                tokenPlan
                    ? "Token Plan 视觉模型认证失败，请检查当前区域的 sk-sp- 专属 API Key"
                    : "视觉模型认证失败，请检查 API Key",
                response.error.status
            )
        case "MODEL_NOT_FOUND":
            return new VisionProviderError(
                "MODEL_NOT_FOUND",
                tokenPlan
                    ? "模型不在当前 Token Plan 套餐或地区支持范围内"
                    : "所选视觉模型不存在或当前账号无权访问",
                response.error.status
            )
        case "RATE_LIMITED":
            return new VisionProviderError(
                "RATE_LIMITED",
                tokenPlan
                    ? "Token Plan 视觉模型请求过于频繁或 Credits 已用尽"
                    : "视觉模型请求过于频繁，请稍后重试",
                response.error.status
            )
        case "INVALID_CONFIGURATION":
            return new VisionProviderError(
                "MODEL_UNAVAILABLE",
                "视觉模型当前不可用，请检查模型配置",
                response.error.status
            )
        case "TIMEOUT_OR_ABORTED":
            return new VisionProviderError(
                "REQUEST_TIMEOUT",
                "视觉模型请求超时或已取消",
                response.error.status
            )
        case "INVALID_RESPONSE":
            return new VisionProviderError(
                "MALFORMED_PROVIDER_RESPONSE",
                "视觉模型返回的结构化结果格式无效",
                response.error.status
            )
        default:
            return new VisionProviderError(
                "PROVIDER_FAILURE",
                "视觉模型服务请求失败",
                response.error.status
            )
    }
}

export async function translateWithVisionModel(
    image: PreparedVisionImage,
    model: BaseModel,
    sender: VisionGatewaySender = sendToModelGateway
): Promise<VisionTranslationResult> {
    const response = await sender({
        type: "generate-vision",
        model,
        image: {
            mimeType: image.mimeType,
            base64: image.base64,
            targetLanguage: image.targetLanguage
        }
    })
    if (response.success === false) {
        throw mapGatewayFailure(response, model)
    }
    return parseVisionResponse(response.text, image)
}
