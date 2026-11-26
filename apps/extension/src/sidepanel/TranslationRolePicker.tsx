import styled, { css } from "styled-components"


import { AiRoleOptions } from "@/constants/aiRole"

import { AiRole } from "@/types/config"

import type React from "react"


import { CloseIcon } from "@/components/Icon"

import { useCallback, useEffect, useRef, useState } from "react"

import Select from "@/components/Select"

import { withEnvironmentSuffix } from "@/constants/storage"

const RoleControls = styled.div`
    flex: none;
    display: grid;
    gap: var(--space-2);
    min-width: 0;
`

const RoleRow = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-2);
`

const RoleSelectBox = styled.div`
    flex: 1;
    min-width: 0;
`

const TagList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
`

const rolePill = css`
    flex: none;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-full);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--font-size-xs);

    &[aria-pressed="true"],
    &:has(> button[aria-pressed="true"]),
    &:hover:not(:disabled) {
        border-color: var(--primary-color);
        background: var(--primary-light);
        color: var(--primary-hover);
    }
`

const RoleAction = styled.button`
    padding: var(--space-1) var(--space-2);
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: -2px;
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`

const RoleButton = styled(RoleAction)`
    ${rolePill}
`

const RoleTag = styled.div`
    ${rolePill}
    display: inline-flex;

    > :first-child {
        padding-inline-end: 0;
    }
`

const RemoveRoleButton = styled(RoleAction)`
    display: grid;
    place-items: center start;
    min-width: var(--space-6);
    padding-inline: var(--space-1);

    svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
    }
`

const RoleHint = styled.p`
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
`

interface TranslationRolePickerProps {
    value: AiRole
    disabled: boolean
    onChange: (role: AiRole) => void
}

interface PinnedRoleTagProps {
    role: AiRole
    selected: boolean
    disabled: boolean
    onSelect: (role: AiRole) => void
    onRemove: (role: AiRole, restoreFocus: boolean) => void
}

const roleLabels = new Map(
    AiRoleOptions.map(({ value, label }) => [value, label])
)

function parsePinnedRoles(value: string | null): AiRole[] {
    try {
        const roles: unknown = JSON.parse(value ?? "[]")
        if (Array.isArray(roles)) {
            return [
                ...new Set(
                    roles.filter(
                        (role): role is AiRole =>
                            role !== AiRole.DEFAULT && roleLabels.has(role)
                    )
                )
            ]
        }
    } catch {
        // 忽略无法解析的旧数据。
    }
    return []
}

const PinnedRoleTag: React.FC<PinnedRoleTagProps> = ({
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
