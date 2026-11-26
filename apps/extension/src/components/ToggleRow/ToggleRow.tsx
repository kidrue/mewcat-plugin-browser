import React from "react"

import CustomToggle from "../Switch"
import {
    SCxToggleDescription,
    SCxToggleLabel,
    SCxToggleRow,
    SCxToggleTitle
} from "./styles"
import type { ToggleRowProps } from "./types"

export const ToggleRow: React.FC<ToggleRowProps> = ({
    title,
    description,
    checked,
    onChange,
    className
}) => {
    return (
        <SCxToggleRow className={className}>
            <SCxToggleLabel>
                <SCxToggleTitle>{title}</SCxToggleTitle>
                <SCxToggleDescription>{description}</SCxToggleDescription>
            </SCxToggleLabel>
            <CustomToggle checked={checked} onChange={onChange} />
        </SCxToggleRow>
    )
}
