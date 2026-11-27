import type { TextTranslationUsageEntry } from "@/features/token-usage"

export type CharacterUsageState =
    | { status: "loading" | "error" }
    | { status: "ready"; entries: TextTranslationUsageEntry[] }
