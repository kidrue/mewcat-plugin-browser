import { readTextTranslationUsage } from "@/features/token-usage/textTranslationUsage"

import type { CharacterUsageState } from "./types"

export async function loadCharacterUsage(): Promise<CharacterUsageState> {
    try {
        return { status: "ready", entries: await readTextTranslationUsage() }
    } catch {
        return { status: "error" }
    }
}
