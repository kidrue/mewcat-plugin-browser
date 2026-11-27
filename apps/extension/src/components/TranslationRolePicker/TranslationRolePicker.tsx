import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { AddIcon } from "@/components/Icon"
import Select from "@/components/Select"
import { AiRoleOptions } from "@/constants/aiRole"
import { withEnvironmentSuffix } from "@/constants/storage"
import { AiRole } from "@/types/config"

import { roleLabels } from "./constants"
import { PinnedRoleTag } from "./PinnedRoleTag"
import {
    AddRoleButton,
    RoleButton,
    RoleControls,
    RoleHint,
    TagList
} from "./styles"
import type { TranslationRolePickerProps } from "./types"
import { parsePinnedRoles } from "./utils"

type SelectChange = React.ComponentProps<typeof Select>["onChange"]

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

function renderAddRoleTrigger(props: React.ComponentPropsWithRef<"button">) {
    return (
        <AddRoleButton {...props}>
            <AddIcon />
        </AddRoleButton>
    )
}

export const TranslationRolePicker: React.FC<TranslationRolePickerProps> = ({
    value,
    disabled,
    onChange
}) => {
    const [pinnedRoles, setPinnedRoles] = useState(loadPinnedRoles)
    const [storageFailed, setStorageFailed] = useState(false)

    const defaultRoleRef = useRef<HTMLButtonElement>(null)

    const availableRoles = AiRoleOptions.filter(
        ({ value: role }) =>
            role !== AiRole.DEFAULT && !pinnedRoles.includes(role)
    )

    const setRolePinned = useCallback(
        (role: AiRole, pinned: boolean) => {
            const update = (roles: AiRole[]) => {
                const next = new Set(roles)
                if (pinned) {
                    next.add(role)
                } else {
                    next.delete(role)
                }
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

    const selectRole = useCallback<SelectChange>(
        role => onChange(role as AiRole),
        [onChange]
    )

    const selectDefaultRole = useCallback(
        () => onChange(AiRole.DEFAULT),
        [onChange]
    )

    const addRole = useCallback<SelectChange>(
        role => setRolePinned(role as AiRole, true),
        [setRolePinned]
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

    useEffect(() => {
        const syncPinnedRoles = (event: StorageEvent) => {
            if (event.key === PINNED_ROLES_KEY || event.key === null) {
                setPinnedRoles(loadPinnedRoles())
            }
        }
        window.addEventListener("storage", syncPinnedRoles)
        return () => window.removeEventListener("storage", syncPinnedRoles)
    }, [])

    return (
        <RoleControls>
            <Select
                aria-label="翻译角色"
                value={value}
                onChange={selectRole}
                options={AiRoleOptions}
                disabled={disabled}
                withinPortal
            />
            <TagList role="group" aria-label="常用翻译角色">
                <RoleButton
                    ref={defaultRoleRef}
                    type="button"
                    aria-pressed={value === AiRole.DEFAULT}
                    onClick={selectDefaultRole}
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
                <Select
                    aria-label="添加常用翻译角色"
                    searchPlaceholder="搜索翻译角色"
                    emptyMessage={
                        availableRoles.length ? undefined : "所有角色均已添加"
                    }
                    value=""
                    onChange={addRole}
                    options={availableRoles}
                    disabled={disabled}
                    renderTrigger={renderAddRoleTrigger}
                    dropdownWidth={240}
                    placement="bottom-end"
                    withinPortal
                />
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
