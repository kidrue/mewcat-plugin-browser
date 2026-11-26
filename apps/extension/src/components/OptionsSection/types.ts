import type React from "react"

import type { SkyIllustration, SkyScene } from "@/components/SkyArtwork"

export interface OptionsSectionProps {
    title: string
    description?: string
    artwork?: SkyScene
    icon?: SkyIllustration
    rightSection?: React.ReactNode
    layout?: "default" | "grid" | "horizontal"
    children: React.ReactNode
    className?: string
}
