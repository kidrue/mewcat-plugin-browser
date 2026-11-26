import type React from "react"
import { useCallback } from "react"

import { CloseIcon } from "@/components/Icon"

import { roleLabels } from "./constants"
import { RemoveRoleButton, RoleAction, RoleTag } from "./styles"
import type { PinnedRoleTagProps } from "./types"

export const PinnedRoleTag: React.FC<PinnedRoleTagProps> = ({
    role,
    selected,
    disabled,
    onSelect,
    onRemove
}) => {
    const label = roleLabels.get(role)
    const select = useCallback(() => onSelect(role), [onSelect, role])
    const remove = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            onRemove(role, document.activeElement === event.currentTarget)
        },
        [onRemove, role]
    )

    return (
        <RoleTag>
            <RoleAction
                type="button"
                aria-pressed={selected}
                onClick={select}
                disabled={disabled}
            >
                {label}
            </RoleAction>
            <RemoveRoleButton
                type="button"
                aria-label={`从常用翻译角色移除${label}`}
                onClick={remove}
            >
                <CloseIcon />
            </RemoveRoleButton>
        </RoleTag>
    )
}
