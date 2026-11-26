import type { TextTranslationUsageEntry } from "@/features/token-usage/textTranslationUsage"

export type CharacterUsageState =
    | { status: "loading" | "error" }
    | { status: "ready"; entries: TextTranslationUsageEntry[] }
