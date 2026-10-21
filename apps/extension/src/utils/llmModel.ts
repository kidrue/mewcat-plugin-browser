import { find } from "ramda"

import { THINKING_CAPABLE_PLATFORMS } from "@/constants/model"
import type { BaseModel } from "@/types"

export function getModelByModelList(modelList: BaseModel[], model: string) {
    return find(item => item.id === model, modelList)
}

/**
 * 检查 BaseModel 是否支持思考能力
 * 按 platform 白名单判断
 */
export function isModelThinkingCapable(
    model: BaseModel | undefined | null
): boolean {
    if (!model?.type) {
        return false
    }
    return THINKING_CAPABLE_PLATFORMS.has(model.type)
}
