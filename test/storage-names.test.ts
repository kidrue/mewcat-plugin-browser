import { describe, expect, it } from "vitest"

import {
    createStructuredImageCachePrefix,
    createStorageNames,
    withEnvironmentSuffix
} from "../src/constants/storage"

describe("storage environment names", () => {
    it("keeps production storage names unchanged", () => {
        expect(withEnvironmentSuffix("editorconfig", "production")).toBe(
            "editorconfig"
        )
        expect(createStorageNames("production")).toEqual({
            extensionConfig: "extension-config",
            accessToken: "accessToken",
            refreshToken: "refreshToken",
            translationCacheDatabase: "translation-cache-db",
            legacyImageCachePrefix: "img_cache_",
            legacyImageCacheMetadata: "img_cache_metadata",
            modelCatalogCachePrefix: "model-catalog:"
        })
    })

    it("adds the dev marker to development storage namespaces", () => {
        expect(withEnvironmentSuffix("editorconfig", "development")).toBe(
            "editorconfig-dev"
        )
        expect(createStorageNames("development")).toEqual({
            extensionConfig: "extension-config-dev",
            accessToken: "accessToken-dev",
            refreshToken: "refreshToken-dev",
            translationCacheDatabase: "translation-cache-db-dev",
            legacyImageCachePrefix: "img_cache-dev_",
            legacyImageCacheMetadata: "img_cache-dev_metadata",
            modelCatalogCachePrefix: "model-catalog-dev:"
        })
    })

    it("does not treat test mode as a development extension build", () => {
        expect(withEnvironmentSuffix("editorconfig", "test")).toBe(
            "editorconfig"
        )
    })

    it("marks the versioned image cache namespace in development", () => {
        expect(createStructuredImageCachePrefix(2, "development")).toBe(
            "img_translation_v2-dev_"
        )
        expect(createStructuredImageCachePrefix(2, "production")).toBe(
            "img_translation_v2_"
        )
    })
})
