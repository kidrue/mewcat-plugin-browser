import type React from "react"

import { getAssetUrl } from "./assets"
import { ArtworkImage } from "./styles"
import type { SkyArtworkProps } from "./types"

/** 晴空来信看板娘澄羽，默认作为装饰图片渲染，不冒充 Live2D。 */
export const SkyMascot: React.FC<SkyArtworkProps> = ({ className }) => {
    return (
        <ArtworkImage
            className={className}
            src={getAssetUrl("assets/sky-letter/chengyu.png")}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
        />
    )
}
