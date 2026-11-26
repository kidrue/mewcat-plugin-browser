import type React from "react"

import type { SkyIllustration, SkyScene } from "@/components/SkyArtwork"

export type OptionsFeatureCardsProps = {
    label: string
    children: React.ReactNode
}

export interface OptionsPageIntroProps {
    title: string
    description: string
    scene?: SkyScene
    icon?: SkyIllustration
    children?: React.ReactNode
}
