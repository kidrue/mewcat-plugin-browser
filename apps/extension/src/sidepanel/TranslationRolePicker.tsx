import { useEffect, useState } from "react"
import styled from "styled-components"

import NativeSelect from "@/components/NativeSelect"
import { AiRoleOptions } from "@/constants/aiRole"
import { withEnvironmentSuffix } from "@/constants/storage"
import { AiRole } from "@/types/config"

const PINNED_ROLES_KEY = withEnvironmentSuffix(
    "sidepanel-pinned-roles",
    import.meta.env.MODE
)
const roleLabels = new Map(
    AiRoleOptions.map(({ value, label }) => [value, label])
)

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

const RoleSelect = styled(NativeSelect)`
    flex: 1;
    min-width: 0;
`

const TagList = styled.div`
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
`

const RoleButton = styled.button`
    flex: none;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-full);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;

    &[aria-pressed="true"],
    &:hover:not(:disabled) {
        border-color: var(--primary-color);
        background: var(--primary-light);
        color: var(--primary-hover);
    }

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: -2px;
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`

const RoleHint = styled.p`
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
`

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

function loadPinnedRoles(): AiRole[] {
    try {
        return parsePinnedRoles(localStorage.getItem(PINNED_ROLES_KEY))
    } catch {
        return []
    }
}

interface TranslationRolePickerProps {
    value: AiRole
    disabled: boolean
    onChange: (role: AiRole) => void
}

export function TranslationRolePicker({
    value,
    disabled,
    onChange
}: TranslationRolePickerProps) {
    const [pinnedRoles, setPinnedRoles] = useState(loadPinnedRoles)
    const [storageFailed, setStorageFailed] = useState(false)
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

    const togglePinnedRole = () => {
        const update = (roles: AiRole[]) => {
            const next = new Set(roles)
            if (isPinned) next.delete(value)
            else next.add(value)
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
    }

    return (
        <RoleControls>
            <RoleRow>
                <RoleSelect
                    aria-label="翻译角色"
                    value={value}
                    onChange={role => onChange(role as AiRole)}
                    options={AiRoleOptions}
                    size="sm"
                    disabled={disabled}
                />
                {!disabled && value !== AiRole.DEFAULT && (
                    <RoleButton type="button" onClick={togglePinnedRole}>
                        {isPinned ? "取消固定" : "固定"}
                    </RoleButton>
                )}
            </RoleRow>
            <TagList role="group" aria-label="常用翻译角色">
                {[AiRole.DEFAULT, ...pinnedRoles].map(role => (
                    <RoleButton
                        key={role}
                        type="button"
                        aria-pressed={role === value}
                        onClick={() => onChange(role)}
                        disabled={disabled && role !== AiRole.DEFAULT}
                    >
                        {roleLabels.get(role)}
                    </RoleButton>
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
