import { franc } from "franc"

import { languages } from "@/constants"

import { francToI18nMap, getEnhancedLanguageCode } from "./francLanguageMap"

export function detectPageLanguage(): string | undefined {
    const text = document.body?.innerText ?? document.body?.textContent ?? ""
    const detected = franc(text)
    if (!francToI18nMap.has(detected)) {
        return undefined
    }
    const normalized = getEnhancedLanguageCode(detected, text)
    return languages.languages.find(language => language.value === normalized)
        ?.value
}
