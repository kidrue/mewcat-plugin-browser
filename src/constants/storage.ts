export type StorageBuildMode = "development" | "production" | "test" | string

const BUILD_MODE = import.meta.env?.MODE ?? "production"

export function withEnvironmentSuffix(
    name: string,
    mode: StorageBuildMode
): string {
    return mode === "development" ? `${name}-dev` : name
}

export function createStorageNames(mode: StorageBuildMode) {
    return {
        extensionConfig: withEnvironmentSuffix("extension-config", mode),
        accessToken: withEnvironmentSuffix("accessToken", mode),
        refreshToken: withEnvironmentSuffix("refreshToken", mode),
        translationCacheDatabase: withEnvironmentSuffix(
            "translation-cache-db",
            mode
        ),
        legacyImageCachePrefix: `${withEnvironmentSuffix("img_cache", mode)}_`,
        legacyImageCacheMetadata: `${withEnvironmentSuffix("img_cache", mode)}_metadata`,
        modelCatalogCachePrefix: `${withEnvironmentSuffix("model-catalog", mode)}:`
    }
}

export const STORAGE_NAMES = createStorageNames(BUILD_MODE)

export function createStructuredImageCachePrefix(
    schemaVersion: number,
    mode: StorageBuildMode = BUILD_MODE
): string {
    return `${withEnvironmentSuffix(
        `img_translation_v${schemaVersion}`,
        mode
    )}_`
}

export function toWxtLocalStorageKey(key: string): `local:${string}` {
    return `local:${key}`
}

export function toWxtSyncStorageKey(key: string): `sync:${string}` {
    return `sync:${key}`
}
