import { handleModelGatewayRequest } from "@/background/messages/model-gateway"
import type {
    ModelGatewayGenerateVisionRequest,
    ModelGatewayResponse
} from "@/messaging/modelGatewayContracts"
import type { BaseModel } from "@/types/aiModel"

import { VisionProviderError } from "./errors"
import { parseVisionResponse } from "./schema"
import type { PreparedVisionImage, VisionTranslationResult } from "./types"

export type VisionGatewaySender = (
    request: ModelGatewayGenerateVisionRequest
) => Promise<ModelGatewayResponse>

const sendToModelGateway: VisionGatewaySender = request =>
    handleModelGatewayRequest(request)

const mapGatewayFailure = (
    response: Extract<ModelGatewayResponse, { success: false }>
): VisionProviderError => {
    switch (response.error.code) {
        case "AUTHENTICATION_FAILED":
            return new VisionProviderError(
                "AUTHENTICATION_FAILED",
                "视觉模型认证失败，请检查 API Key",
                response.error.status
            )
        case "RATE_LIMITED":
            return new VisionProviderError(
                "RATE_LIMITED",
                "视觉模型请求过于频繁，请稍后重试",
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
        throw mapGatewayFailure(response)
    }
    return parseVisionResponse(response.text, image)
}
