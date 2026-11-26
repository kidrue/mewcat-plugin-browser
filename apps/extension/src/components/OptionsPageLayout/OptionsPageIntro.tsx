import React from "react"

import { SkyBackdrop } from "@/components/SkyArtwork"

import {
    Actions,
    Artwork,
    Description,
    Intro,
    IntroHeading,
    IntroIcon,
    Title
} from "./styles"
import type { OptionsPageIntroProps } from "./types"

export const OptionsPageIntro: React.FC<OptionsPageIntroProps> = ({
    title,
    description,
    scene = "postOffice",
    icon,
    children
}) => {
    return (
        <Intro>
            <Artwork aria-hidden="true">
                <SkyBackdrop scene={scene} />
            </Artwork>
            <IntroHeading>
                {icon && <IntroIcon kind={icon} />}
                <Title>{title}</Title>
            </IntroHeading>
            <Description>{description}</Description>
            {children && <Actions>{children}</Actions>}
        </Intro>
    )
}
