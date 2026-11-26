import type React from "react"

import { ArtworkImage } from "./styles"
import type { SkyArtworkProps, SkyScene } from "./types"
import { getSkySceneUrl } from "./utils"

// 共用的本地邮局背景。组件只提供资源和无障碍默认值，
// 由 Options、popup 等入口决定尺寸、裁切与文字遮罩。
export const SkyBackdrop: React.FC<SkyArtworkProps & { scene?: SkyScene }> = ({
    className,
    scene = "postOffice"
}) => {
    return (
        <ArtworkImage
            className={className}
            src={getSkySceneUrl(scene)}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
        />
    )
}
