import type React from "react"

import { getAssetUrl } from "./assets"
import { ArtworkImage } from "./styles"
import type { SkyReadingPortraitProps } from "./types"

/** 阅读姿态为浅蓝纸面肖像，独立裁切使用，不作为透明立绘。 */
export const SkyReadingPortrait: React.FC<SkyReadingPortraitProps> = ({
    className
}) => {
    return (
        <ArtworkImage
            className={className}
            src={getAssetUrl("assets/sky-letter/chengyu-reading.png")}
            width={1024}
            height={1536}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
        />
    )
}
