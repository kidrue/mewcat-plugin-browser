// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"

import { TieredTranslationCache } from "../src/translation/cache/TieredTranslationCache"
import type { CacheKeyParams } from "../src/translation/cache/types"
import { ImmersiveTranslator } from "../src/translation/ImmersiveTranslator"

describe("page translation cache refresh", () => {
    let cache: TieredTranslationCache | undefined

    afterEach(() => {
        cache?.destroy()
        cache = undefined
    })

    it("deletes only the requested page translation entries", async () => {
        cache = new TieredTranslationCache({ enableL2: false })
        const baseParams: Omit<CacheKeyParams, "text"> = {
            sourceLang: "en",
            targetLang: "zh-CN",
            modelId: "model-a",
            aiRole: "DEFAULT"
        }
        const currentPageEntries = [
            { ...baseParams, text: "Current page title" },
            { ...baseParams, text: "Current page paragraph" }
        ]
        const otherEntry = { ...baseParams, text: "Other cached paragraph" }

        await cache.batchSet([
            { params: currentPageEntries[0], translation: "当前页标题" },
            { params: currentPageEntries[1], translation: "当前页段落" },
            { params: otherEntry, translation: "其他缓存段落" }
        ])

        await cache.batchDelete([
            currentPageEntries[0],
            currentPageEntries[1],
            currentPageEntries[0]
        ])

        expect(await cache.get(currentPageEntries[0])).toBeNull()
        expect(await cache.get(currentPageEntries[1])).toBeNull()
        expect(await cache.get(otherEntry)).toBe("其他缓存段落")
    })

    it("clears current page entries with the active model and AI role", async () => {
        cache = new TieredTranslationCache({ enableL2: false })
        const activeEntry: CacheKeyParams = {
            text: "Repeated current page text",
            sourceLang: "en",
            targetLang: "zh-CN",
            modelId: "model-a",
            aiRole: "DEFAULT"
        }
        const secondActiveEntry = {
            ...activeEntry,
            text: "Another current page text"
        }
        const otherModelEntry = { ...activeEntry, modelId: "model-b" }
        const otherRoleEntry = { ...activeEntry, aiRole: "ACADEMIC" }

        await cache.batchSet([
            { params: activeEntry, translation: "当前页重复文本" },
            { params: secondActiveEntry, translation: "当前页另一段文本" },
            { params: otherModelEntry, translation: "其他模型译文" },
            { params: otherRoleEntry, translation: "其他角色译文" }
        ])

        const translator = Object.create(
            ImmersiveTranslator.prototype
        ) as ImmersiveTranslator
        Object.assign(translator as unknown as Record<string, unknown>, {
            translationCache: cache,
            sourceTextNodes: [
                { originText: activeEntry.text },
                { originText: activeEntry.text },
                { originText: secondActiveEntry.text }
            ],
            detectedLanguage: activeEntry.sourceLang,
            targetLanguage: activeEntry.targetLang,
            currentModel: activeEntry.modelId,
            translationRuntimeConfig: { aiRole: activeEntry.aiRole },
            isTranslationAborted: false
        })

        await expect(
            translator.clearCurrentPageTranslationCache()
        ).resolves.toBe(2)
        expect(await cache.get(activeEntry)).toBeNull()
        expect(await cache.get(secondActiveEntry)).toBeNull()
        expect(await cache.get(otherModelEntry)).toBe("其他模型译文")
        expect(await cache.get(otherRoleEntry)).toBe("其他角色译文")
    })
})
