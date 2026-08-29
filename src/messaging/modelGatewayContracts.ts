import type { BaseModel } from "@/types/aiModel"

export interface ModelGatewayMessage {
    role: "assistant" | "system" | "user"
    content: string
}

export interface ModelGatewayGenerateRequest {
    type: "generate"
    model: BaseModel
    messages: ModelGatewayMessage[]
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
