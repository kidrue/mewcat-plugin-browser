import { AiModel_Platform_Enum, type BaseModel } from "@/types/aiModel"

export interface RemoteModel {
    id: string
    name?: string
}

export interface CatalogModel {
    id: string
    name: string
    modalities?: {
        input?: string[]
    }
}

export interface DiscoveredModel {
    id: string
    name: string
    availability: "verified" | "catalog"
    vision: "supported" | "unsupported" | "unknown"
}

const normalizeModelId = (id: string): string =>
    id.trim().replace(/^models\//, "")

const getVisionCapability = (
    model: CatalogModel | undefined
): DiscoveredModel["vision"] => {
    const input = model?.modalities?.input
    if (!input) {return "unknown"}
    return input.includes("image") ? "supported" : "unsupported"
}

export function mergeDiscoveredModels(
    remoteModels: RemoteModel[] | null,
    catalogModels: CatalogModel[]
): DiscoveredModel[] {
    const catalogById = new Map(
        catalogModels.map(model => [normalizeModelId(model.id), model])
    )
    const source = remoteModels ?? catalogModels
    const availability = remoteModels ? "verified" : "catalog"

    return source
        .map(model => {
            const id = normalizeModelId(model.id)
            const catalogModel = catalogById.get(id)
            return {
                id,
                name: catalogModel?.name || model.name || id,
                availability,
                vision: getVisionCapability(catalogModel)
            } satisfies DiscoveredModel
        })
        .sort((left, right) => left.id.localeCompare(right.id))
}

export function migrateLegacyModel(model: BaseModel): BaseModel {
    const legacyParams = model.params as BaseModel["params"] & {
        endpoint?: string
    }
    if (!Object.prototype.hasOwnProperty.call(legacyParams, "endpoint")) {
        return model
    }
    const { endpoint, ...params } = legacyParams

    return {
        ...model,
        params: {
            ...params,
            modelName:
                model.type === AiModel_Platform_Enum.HUOSHAN &&
                !params.modelName.trim() &&
                endpoint?.trim()
                    ? endpoint.trim()
                    : params.modelName
        }
    }
}
