import { css } from "styled-components"

import { getAssetUrl } from "./assets"
import { SKY_SCENES } from "./constants"
import type { SkyScene } from "./types"

export const getSkySceneUrl = (scene: SkyScene) =>
    getAssetUrl(`assets/sky-letter/${SKY_SCENES[scene]}`)

export const skyCardArtwork = (scene: SkyScene) => css`
    background-image:
        linear-gradient(
            105deg,
            rgb(255 255 255 / calc(1 - 0.15 * var(--card-artwork-opacity))) 15%,
            rgb(255 255 255 / calc(1 - 0.35 * var(--card-artwork-opacity))) 55%,
            rgb(255 255 255 / calc(1 - var(--card-artwork-opacity)))
        ),
        url("${getSkySceneUrl(scene)}");
    background-repeat: no-repeat;
    background-position: right center;
    background-size: cover;
`
