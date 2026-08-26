import { PLATFORM_OFFICIAL_BASE_URLS } from "../constants/model"
import { AiModel_Platform_Enum, type BaseModel } from "../types/aiModel"
import { VisionProviderError } from "./errors"

const requireBaseUrl = (model: BaseModel): URL => {
    const baseUrl =
        model.params.isOfficial === false
            ? model.params.baseUrl
            : PLATFORM_OFFICIAL_BASE_URLS[model.type]
    if (!baseUrl?.trim()) {
        throw new VisionProviderError(
            "PROVIDER_FAILURE",
            "视觉模型缺少可用的服务地址"
        )
    }
    try {
        return new URL(baseUrl.trim())
    } catch {
        throw new VisionProviderError(
            "PROVIDER_FAILURE",
            "视觉模型服务地址无效"
        )
    }
}

export function resolveVisionEndpoint(model: BaseModel): string {
    const endpoint = requireBaseUrl(model)
    const pathname = endpoint.pathname.replace(/\/+$/, "")
    if (model.type === AiModel_Platform_Enum.GEMINI) {
        if (!/:generateContent$/i.test(pathname)) {
            endpoint.pathname = `${pathname}/${encodeURIComponent(model.params.modelName)}:generateContent`
        } else {
            endpoint.pathname = pathname
        }
        return endpoint.toString()
    }
    if (!/\/chat\/completions$/i.test(pathname)) {
        endpoint.pathname = `${pathname}/chat/completions`
    } else {
        endpoint.pathname = pathname
    }
    return endpoint.toString()
}
