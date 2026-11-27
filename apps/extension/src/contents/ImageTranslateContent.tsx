import type React from "react"
import { StyleSheetManager } from "styled-components"

import { extensionShadowRootContainerId } from "@/constants"

import { getShadowHostId, ImageTranslate } from "./imageTranslate"

export const ImageTranslateContent: React.FC = () => {
    const shadowRoot = document.getElementById(getShadowHostId())?.shadowRoot
    if (!shadowRoot) {
        return null
    }

    return (
        <StyleSheetManager target={shadowRoot as unknown as HTMLElement}>
            <div id={extensionShadowRootContainerId}>
                <ImageTranslate />
            </div>
        </StyleSheetManager>
    )
}
