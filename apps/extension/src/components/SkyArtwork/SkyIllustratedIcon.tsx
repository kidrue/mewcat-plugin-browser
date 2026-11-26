import type React from "react"

import { getAssetUrl } from "./assets"
import { ArtworkImage } from "./styles"
import type { SkyArtworkProps, SkyIllustration } from "./types"

/** 独立透明底插画图标，仅作装饰，不代替操作按钮的可访问名称。 */
export const SkyIllustratedIcon: React.FC<
    SkyArtworkProps & { kind: SkyIllustration }
> = ({ kind, className }) => {
    return (
        <ArtworkImage
            className={className}
            src={getAssetUrl(`assets/sky-letter/icon-${kind}.png`)}
            width={64}
            height={64}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
        />
    )
}
