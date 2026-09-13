import type { TokenUsageFeature } from "@/token-usage/types"
import type { BaseModel } from "@/types/aiModel"

export interface ModelGatewayMessage {
    role: "assistant" | "system" | "user"
    content: string
}

export interface ModelGatewayGenerateRequest {
    type: "generate"
    model: BaseModel
    messages: ModelGatewayMessage[]
    feature: TokenUsageFeature
    enableThinking?: boolean
    timeoutMs?: number
}

export interface ModelGatewayTranslateEngineRequest {
    type: "translate-engine"
    model: BaseModel
    texts: string[]
    targetLanguage: string
    timeoutMs?: number
}

export interface ModelGatewayGenerateVisionRequest {
    type: "generate-vision"
    model: BaseModel
    image: {
        mimeType: string
        base64: string
        targetLanguage: string
    }
    feature: "image-translation"
    timeoutMs?: number
}

export interface ModelGatewayAbortRequest {
    type: "abort"
}

export type ModelGatewayRequest =
    | ModelGatewayGenerateRequest
    | ModelGatewayGenerateVisionRequest
    | ModelGatewayTranslateEngineRequest
    | ModelGatewayAbortRequest

export type ModelGatewayErrorCode =
    | "AUTHENTICATION_FAILED"
    | "INVALID_CONFIGURATION"
    | "RATE_LIMITED"
    | "MODEL_NOT_FOUND"
    | "TIMEOUT_OR_ABORTED"
    | "INVALID_RESPONSE"
    | "NETWORK_FAILURE"

export interface ModelGatewaySuccessResponse {
    success: true
    text: string
}

export interface ModelGatewayFailureResponse {
    success: false
    error: {
        code: ModelGatewayErrorCode
        message: string
        status?: number
    }
}

export type ModelGatewayResponse =
    | ModelGatewaySuccessResponse
    | ModelGatewayFailureResponse

export const MODEL_GATEWAY_STREAM_PORT = "mewcat-concept-stream"
export const MODEL_GATEWAY_STREAM_TIMEOUT_MS = 5 * 60 * 1000

export interface ModelGatewayStreamOptions {
    signal?: AbortSignal
    onDelta: (text: string) => void
}

export type ModelGatewayStreamEvent =
    | { type: "delta"; text: string }
    | { type: "complete"; response: ModelGatewayResponse }
    | { type: "heartbeat" }

export type ModelGatewayStreamSender = (
    request: ModelGatewayGenerateRequest,
    options: ModelGatewayStreamOptions
) => Promise<ModelGatewayResponse>
