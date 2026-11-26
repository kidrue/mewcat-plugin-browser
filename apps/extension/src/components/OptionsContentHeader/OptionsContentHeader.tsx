import React from "react"

import {
    Brand,
    BrandName,
    HeaderContainer,
    Masthead,
    Seam,
    Status,
    Version
} from "./styles"
import type { OptionsContentHeaderProps } from "./types"

export const OptionsContentHeader: React.FC<OptionsContentHeaderProps> = ({
    title,
    version,
    status,
    className
}) => {
    return (
        <HeaderContainer className={className}>
            <Masthead>
                <Brand>
                    <BrandName>{title}</BrandName>
                    {version && <Version>{version}</Version>}
                </Brand>
                {status && <Status>{status}</Status>}
            </Masthead>
            <Seam aria-hidden="true" />
        </HeaderContainer>
    )
}
