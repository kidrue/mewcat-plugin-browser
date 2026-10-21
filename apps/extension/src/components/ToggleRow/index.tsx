import React from "react"
import styled from "styled-components"

import CustomToggle from "../Switch"

interface ToggleRowProps {
    title: string
    description: string
    checked: boolean
    onChange: (checked: boolean) => void
    className?: string
}

const SCxToggleRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-light);
    transition: var(--transition-base);

    &:last-child {
        border-bottom: none;
    }

    &:hover {
        background: var(--gray-50);
        border-radius: var(--radius-md);
    }
`

const SCxToggleLabel = styled.div`
    flex: 1;
    padding-right: var(--space-4);
`

const SCxToggleTitle = styled.div`
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    margin-bottom: var(--space-1);
`

const SCxToggleDescription = styled.div`
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: var(--line-height-normal);
`

const ToggleRow: React.FC<ToggleRowProps> = ({
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

export default ToggleRow
