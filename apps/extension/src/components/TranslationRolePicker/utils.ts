import { AiRole } from "@/types/config"

import { roleLabels } from "./constants"

export function parsePinnedRoles(value: string | null): AiRole[] {
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
