import type React from "react"

import { ArtworkImage } from "./styles"
import type { SkyBackdropProps } from "./types"
import { getSkySceneUrl } from "./utils"

// 邮局背景的尺寸、裁切和文字遮罩由调用方决定。
export const SkyBackdrop: React.FC<SkyBackdropProps> = ({
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
