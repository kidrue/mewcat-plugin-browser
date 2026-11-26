import React from "react"

import { SCxInfoRow, SCxLabel, SCxValue } from "./styles"
import type { InfoDisplayProps } from "./types"

export const InfoDisplay: React.FC<InfoDisplayProps> = ({
    label,
    value,
    type = "text",
    className
}) => {
    return (
        <SCxInfoRow className={className}>
            <SCxLabel>{label}</SCxLabel>
            <SCxValue valueType={type}>{value}</SCxValue>
        </SCxInfoRow>
    )
}
