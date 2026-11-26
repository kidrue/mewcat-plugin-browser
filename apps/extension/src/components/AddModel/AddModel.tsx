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

import { AI_TRANSLATION_SERVICES } from "@/constants"

import Button from "../Button"
import { SCXList, SCXListItem } from "./styles"
import type { AddModelProps } from "./types"

export const AddModel: React.FC<AddModelProps> = ({
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
