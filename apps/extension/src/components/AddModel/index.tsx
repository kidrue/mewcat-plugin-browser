import {
    flip,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole
} from "@floating-ui/react"
import React, { useState } from "react"
import { styled } from "styled-components"

import { AI_TRANSLATION_SERVICES } from "@/constants"
import type { AiModel_Platform_Enum } from "@/types"

import Button from "../Button"

interface AddModelProps {
    onItemClick: (platform: AiModel_Platform_Enum) => void
    label?: string
}

const SCXList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 0;
    width: 150px;
    background-color: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-2) 0;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    z-index: var(--z-dropdown);
`

const SCXListItem = styled.li`
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    transition: all var(--transition-fast);

    &:hover {
        background-color: var(--gray-100);
    }
`

export const AddModel: React.FunctionComponent<AddModelProps> = ({
    onItemClick,
    label = "添加模型"
}) => {
    const [isOpen, setIsOpen] = useState(false)

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        placement: "bottom-end",
        transform: true,
        onOpenChange: setIsOpen,
        middleware: [shift(), flip()]
    })

    const click = useClick(context)
    const role = useRole(context)
    const dismiss = useDismiss(context)

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        role,
        dismiss
    ])

    return (
        <>
            <Button
                type="primary"
                ref={refs.setReference}
                onClick={() => setIsOpen(true)}
                {...getReferenceProps()}
            >
                {label}
            </Button>
            {isOpen && (
                <SCXList
                    ref={refs.setFloating}
                    {...getFloatingProps()}
                    style={floatingStyles}
                >
                    {AI_TRANSLATION_SERVICES.map(platform => (
                        <SCXListItem
                            key={platform.key}
                            onClick={() => {
                                setIsOpen(false)
                                onItemClick(platform.type)
                            }}
                        >
                            {platform.name}
                        </SCXListItem>
                    ))}
                </SCXList>
            )}
        </>
    )
}
