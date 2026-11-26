import type { DiscoveredModel } from "@/features/model-management/catalog"
import type { BaseModel } from "@/types/aiModel"

import type { ModelSelectionOption } from "./types"

export function getVisionCapabilityLabel(
    vision: DiscoveredModel["vision"]
): string {
    if (vision === "supported") {
        return "支持图片"
    }
    if (vision === "unsupported") {
        return "仅文本"
    }
    return "图片能力未知"
}

export function toModelCapabilityPatch(
    vision: DiscoveredModel["vision"]
): BaseModel["capabilities"] | undefined {
    if (vision === "supported") {
        return { vision: true }
    }
    if (vision === "unsupported") {
        return { vision: false }
    }
    return undefined
}

export function buildModelSelectionOptions(
    models: DiscoveredModel[],
    currentModelName: string,
    searchQuery = ""
): ModelSelectionOption[] {
    const discoveredOptions = models.map(model => ({
        value: model.id,
        label: `${model.name} · ${getVisionCapabilityLabel(model.vision)}${
            model.availability === "catalog" ? " · 目录" : ""
        }`
    }))
    const options =
        currentModelName.trim() &&
        !models.some(model => model.id === currentModelName)
            ? [
                  {
                      value: currentModelName,
                      label: `${currentModelName}（当前模型未返回）`
                  },
                  ...discoveredOptions
              ]
            : discoveredOptions
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
    if (!normalizedQuery) {
        return options
    }
    return options.filter(option =>
        `${option.value} ${option.label}`
            .toLocaleLowerCase()
            .includes(normalizedQuery)
    )
}
