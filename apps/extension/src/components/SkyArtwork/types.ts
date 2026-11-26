import type { SKY_SCENES } from "./constants"

export interface SkyArtworkProps {
    className?: string
}

export type SkyScene = keyof typeof SKY_SCENES

export type SkyIllustration = "mail" | "book" | "picture" | "ledger"
