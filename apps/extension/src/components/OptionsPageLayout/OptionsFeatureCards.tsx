import React from "react"

import { FeatureCardContainer, FeatureCardGrid } from "./styles"
import type { OptionsFeatureCardsProps } from "./types"

export const OptionsFeatureCards: React.FC<OptionsFeatureCardsProps> = ({
    label,
    children
}) => {
    return (
        <FeatureCardContainer>
            <FeatureCardGrid role="group" aria-label={label}>
                {children}
            </FeatureCardGrid>
        </FeatureCardContainer>
    )
}
