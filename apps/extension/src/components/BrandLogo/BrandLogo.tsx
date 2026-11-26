import type React from "react"

import { LogoImage } from "./styles"
import type { BrandLogoProps } from "./types"

export const BrandLogo: React.FC<BrandLogoProps> = ({
    className,
    size = 40
}) => {
    return (
        <LogoImage
            className={className}
            $size={size}
            src={chrome.runtime.getURL("icons/128.png")}
            alt=""
            aria-hidden="true"
            draggable={false}
        />
    )
}
