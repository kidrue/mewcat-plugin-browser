import React from "react"

import { iconMap } from "./constants"
import { SCxIconContainer } from "./styles"
import type { IconProps } from "./types"

export const Icon: React.FC<IconProps> = ({
    name,
    size = 24,
    color = "currentColor",
    className,
    style,
    onClick
}) => {
    const IconComponent = iconMap[name]

    if (!IconComponent) {
        console.warn(
            `Icon "${name}" not found. Available icons:`,
            Object.keys(iconMap)
        )
        return null
    }

    return (
        <SCxIconContainer
            size={size}
            clickable={!!onClick}
            className={className}
            style={{ color, ...style }}
            onClick={onClick}
        >
            <IconComponent />
        </SCxIconContainer>
    )
}
