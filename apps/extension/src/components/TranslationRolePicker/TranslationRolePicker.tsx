import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import Select from "@/components/Select"
import { AiRoleOptions } from "@/constants/aiRole"
import { withEnvironmentSuffix } from "@/constants/storage"
import { AiRole } from "@/types/config"

import { roleLabels } from "./constants"
import { PinnedRoleTag } from "./PinnedRoleTag"
import {
    RoleButton,
    RoleControls,
    RoleHint,
    RoleRow,
    RoleSelectBox,
    TagList
} from "./styles"
import type { TranslationRolePickerProps } from "./types"
import { parsePinnedRoles } from "./utils"

const PINNED_ROLES_KEY = withEnvironmentSuffix(
    "sidepanel-pinned-roles",
    import.meta.env.MODE
)

function loadPinnedRoles(): AiRole[] {
    try {
        return parsePinnedRoles(localStorage.getItem(PINNED_ROLES_KEY))
    } catch {
        return []
    }
}

export const TranslationRolePicker: React.FC<TranslationRolePickerProps> = ({
    value,
    disabled,
    onChange
}) => {
    const [pinnedRoles, setPinnedRoles] = useState(loadPinnedRoles)
    const [storageFailed, setStorageFailed] = useState(false)

    const defaultRoleRef = useRef<HTMLButtonElement>(null)
    const isPinned = pinnedRoles.includes(value)

    useEffect(() => {
        const syncPinnedRoles = (event: StorageEvent) => {
            if (event.key === PINNED_ROLES_KEY || event.key === null) {
                setPinnedRoles(loadPinnedRoles())
            }
        }
        window.addEventListener("storage", syncPinnedRoles)
        return () => window.removeEventListener("storage", syncPinnedRoles)
    }, [])

    const setRolePinned = useCallback(
        (role: AiRole, pinned: boolean) => {
            const update = (roles: AiRole[]) => {
                const next = new Set(roles)
                if (pinned) next.add(role)
                else next.delete(role)
                return [...next]
            }
            let next: AiRole[]
            try {
                const stored = storageFailed
                    ? pinnedRoles
                    : parsePinnedRoles(localStorage.getItem(PINNED_ROLES_KEY))
                next = update(stored)
                localStorage.setItem(PINNED_ROLES_KEY, JSON.stringify(next))
                setStorageFailed(false)
            } catch {
                next = update(pinnedRoles)
                setStorageFailed(true)
            }
            setPinnedRoles(next)
        },
        [pinnedRoles, storageFailed]
    )

    const removeRole = useCallback(
        (role: AiRole, restoreFocus: boolean) => {
            if (restoreFocus) {
                defaultRoleRef.current?.focus()
            }
            setRolePinned(role, false)
        },
        [setRolePinned]
    )

    return (
        <RoleControls>
            <RoleRow>
                <RoleSelectBox>
                    <Select
                        aria-label="翻译角色"
                        value={value}
                        onChange={role => onChange(role as AiRole)}
                        options={AiRoleOptions}
                        disabled={disabled}
                        withinPortal
                    />
                </RoleSelectBox>
                {!disabled && value !== AiRole.DEFAULT && (
                    <RoleButton
                        type="button"
                        onClick={() => setRolePinned(value, !isPinned)}
                    >
                        {isPinned ? "取消固定" : "固定"}
                    </RoleButton>
                )}
            </RoleRow>
            <TagList role="group" aria-label="常用翻译角色">
                <RoleButton
                    ref={defaultRoleRef}
                    type="button"
                    aria-pressed={value === AiRole.DEFAULT}
                    onClick={() => onChange(AiRole.DEFAULT)}
                >
                    {roleLabels.get(AiRole.DEFAULT)}
                </RoleButton>
                {pinnedRoles.map(role => (
                    <PinnedRoleTag
                        key={role}
                        role={role}
                        selected={role === value}
                        disabled={disabled}
                        onSelect={onChange}
                        onRemove={removeRole}
                    />
                ))}
            </TagList>
            {disabled && (
                <RoleHint>
                    如需使用其他角色，请在设置中切换到支持角色的翻译服务。
                </RoleHint>
            )}
            {storageFailed && (
                <RoleHint role="status">
                    常用角色保存失败，本次打开期间仍可使用。
                </RoleHint>
            )}
        </RoleControls>
    )
}
