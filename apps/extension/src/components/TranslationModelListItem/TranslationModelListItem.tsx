import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type * as React from "react"
import { useCallback } from "react"

import Switch from "@/components/Switch"

import {
    ModelItem,
    ModelItemActions,
    ModelItemContent,
    ModelItemSubtitle,
    ModelItemTitle,
    StatusDot
} from "./styles"
import type { TranslationModelListItemProps } from "./types"

export const TranslationModelListItem: React.FC<
    TranslationModelListItemProps
> = ({
    model,
    isEnabled,
    isSelected,
    isDragging,
    onClick,
    onToggleEnabled,
    id
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        boxShadow: isDragging ? "0 0 0 4px var(--primary-color)" : undefined
    }

    const handleSwitchClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
    }, [])

    const subtitle =
        model.params.modelName ||
        (model.params.isOfficial === false ? "自定义" : "官方")

    return (
        <ModelItem
            key={model.type}
            {...attributes}
            {...listeners}
            onClick={onClick}
            ref={setNodeRef}
            $selected={isSelected}
            style={style}
        >
            <StatusDot $enabled={isEnabled} />
            <ModelItemContent>
                <ModelItemTitle>{model.name}</ModelItemTitle>
                <ModelItemSubtitle>{subtitle}</ModelItemSubtitle>
            </ModelItemContent>
            <ModelItemActions onClick={handleSwitchClick}>
                <Switch
                    checked={isEnabled}
                    onChange={onToggleEnabled}
                    size="sm"
                />
            </ModelItemActions>
        </ModelItem>
    )
}
