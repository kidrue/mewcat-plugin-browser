import {
    DEVICE_ACTIVITY_MAX_REVISION,
    DEVICE_ACTIVITY_UNINSTALL_PATH
} from "@mewcat/client"

import { MEWCAT_SERVICE_ORIGIN } from "@/constants/translationServices"
import type { DeviceActivityStatus } from "@/messaging/protocol"

import { mewCatService } from "../lib/mewcat-service"

const storageKey = "mewcat-device-activity"
const uninstallPathPattern = new RegExp(
    `^${DEVICE_ACTIVITY_UNINSTALL_PATH}/[A-Za-z0-9_-]{32,100}$`
)
const disabled = { enabled: false }
const cleanupPending = {
    enabled: false,
    message: "统计已停止。服务端删除或卸载回调清除尚未完成，请重试。"
}
const enableFailed = {
    enabled: false,
    message: "未能开启统计，请稍后重试。"
}
const pageReports = new Set<AbortController>()

type ActivityRevision = { pendingInstall: boolean; revision: number }
type CleanupState = ActivityRevision & { mode: "cleanup" | "rollback" }
type ActivityState =
    | CleanupState
    | (ActivityRevision &
          ({ mode: "disabled" } | { mode: "enabled"; salt: string }))

let changes: Promise<unknown> = Promise.resolve()

function queueChange<T>(run: () => Promise<T>): Promise<T> {
    const next = changes.then(run)
    changes = next.catch(() => {})
    return next
}

async function readState(): Promise<ActivityState> {
    const stored = await chrome.storage.local.get(storageKey)
    return (
        stored[storageKey] ?? {
            mode: "disabled",
            pendingInstall: false,
            revision: 0
        }
    )
}

function saveState(state: ActivityState) {
    return chrome.storage.local.set({ [storageKey]: state })
}

async function finishDisable(
    state: CleanupState
): Promise<DeviceActivityStatus> {
    const { pendingInstall, revision } = state
    const [callback, remote] = await Promise.allSettled([
        chrome.runtime.setUninstallURL(""),
        mewCatService.deviceActivity({ operation: "disable", revision })
    ])
    if (remote.status !== "fulfilled") {
        return cleanupPending
    }
    const stale = remote.value.revision > revision
    if (stale && state.mode === "cleanup") {
        await saveState({
            ...state,
            revision: Math.min(
                remote.value.revision + 1,
                DEVICE_ACTIVITY_MAX_REVISION
            )
        })
        return cleanupPending
    }
    if (
        callback.status !== "fulfilled" ||
        (!stale && (remote.value.enabled || remote.value.revision !== revision))
    ) {
        return cleanupPending
    }
    // 回滚只清理本次启用；有更新的授权时保留服务端版本。
    await saveState({
        mode: "disabled",
        pendingInstall,
        revision: remote.value.revision
    })
    return disabled
}

async function setEnabled(enabled: boolean): Promise<DeviceActivityStatus> {
    let state = await readState()
    if (enabled && state.mode === "enabled") {
        return { enabled: true }
    }
    if (!enabled && state.mode === "disabled") {
        return disabled
    }

    if (state.mode === "cleanup" || state.mode === "rollback") {
        if (!enabled && state.mode === "rollback") {
            state = { ...state, mode: "cleanup" }
            await saveState(state)
        }
        const status = await finishDisable(state)
        if (!enabled || status.message) {
            return status
        }
        state = await readState()
    }

    const { pendingInstall, revision } = state
    const attempt = Math.min(revision + 1, DEVICE_ACTIVITY_MAX_REVISION)
    if (enabled && attempt === DEVICE_ACTIVITY_MAX_REVISION) {
        return enableFailed
    }
    // 在远端状态变化前持久化清理标记，后台中断后也能继续撤回。
    const cleanup: CleanupState = {
        mode: enabled ? "rollback" : "cleanup",
        pendingInstall,
        revision: enabled ? attempt + 1 : attempt
    }
    await saveState(cleanup)
    if (!enabled) {
        return finishDisable(cleanup)
    }

    try {
        const result = await mewCatService.deviceActivity({
            operation: "enable",
            revision: attempt,
            newInstall: pendingInstall
        })
        if (result.revision > attempt) {
            // 本次启用未生效，保留服务端版本以便之后显式重试。
            await saveState({
                mode: "disabled",
                pendingInstall,
                revision: result.revision
            })
            return enableFailed
        }
        if (
            !result.enabled ||
            result.revision !== attempt ||
            !result.uninstallPath ||
            !uninstallPathPattern.test(result.uninstallPath)
        ) {
            throw new Error("Invalid uninstall path")
        }
        await chrome.runtime.setUninstallURL(
            new URL(result.uninstallPath, MEWCAT_SERVICE_ORIGIN).href
        )
        await saveState({
            mode: "enabled",
            pendingInstall: false,
            revision: attempt,
            salt: crypto.randomUUID()
        })
        return { enabled: true }
    } catch {
        const status = await finishDisable(cleanup)
        return status.message ? cleanupPending : enableFailed
    }
}

export function noteDeviceActivityInstall(
    reason: chrome.runtime.InstalledDetails["reason"]
) {
    if (reason !== "install") {
        return Promise.resolve()
    }
    return queueChange(async () => {
        const state = await readState()
        if (state.mode === "disabled") {
            await saveState({ ...state, pendingInstall: true })
        }
    })
}

export function getDeviceActivityStatus(): Promise<DeviceActivityStatus> {
    return queueChange(async () => {
        const state = await readState()
        if (state.mode === "cleanup" || state.mode === "rollback") {
            return finishDisable(state)
        }
        return { enabled: state.mode === "enabled" }
    })
}

async function reportPage(sender: chrome.runtime.MessageSender) {
    if (sender.frameId !== 0 || sender.tab?.id === undefined || !sender.url) {
        return disabled
    }
    const currentChange = changes
    await currentChange
    const state = await readState()
    if (state.mode !== "enabled") {
        return disabled
    }

    const url = new URL(sender.url)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return disabled
    }
    const data = new TextEncoder().encode(
        JSON.stringify([state.salt, url.hostname, url.pathname])
    )
    const digest = await crypto.subtle.digest("SHA-256", data)
    if (currentChange !== changes) {
        return disabled
    }

    const pageKey = Array.from(new Uint8Array(digest), byte =>
        byte.toString(16).padStart(2, "0")
    ).join("")
    const controller = new AbortController()
    pageReports.add(controller)
    try {
        const result = await mewCatService.deviceActivity(
            {
                operation: "page",
                revision: state.revision,
                eventId: crypto.randomUUID(),
                pageKey
            },
            controller.signal
        )
        if (result.enabled && result.revision === state.revision) {
            return { enabled: true }
        }
        await queueChange(async () => {
            const latest = await readState()
            if (latest.mode === "enabled" && latest.salt === state.salt) {
                await chrome.runtime.setUninstallURL("")
                await saveState({
                    mode: "disabled",
                    pendingInstall: false,
                    revision: Math.max(latest.revision, result.revision)
                })
            }
        })
        return disabled
    } finally {
        pageReports.delete(controller)
    }
}

export async function handleDeviceActivity(
    input: unknown,
    sender: chrome.runtime.MessageSender
): Promise<DeviceActivityStatus> {
    if (
        sender.id !== chrome.runtime.id ||
        !input ||
        typeof input !== "object"
    ) {
        return disabled
    }
    const request = input as { type?: unknown; enabled?: unknown }
    if (request.type === "page-translated") {
        // 页面事件是最佳努力上报，失败时不会进入通用错误监控。
        return reportPage(sender).catch(() => disabled)
    }
    if (
        sender.url?.split(/[?#]/, 1)[0] !==
        chrome.runtime.getURL("options.html")
    ) {
        return disabled
    }
    try {
        if (request.type === "get-status") {
            return await getDeviceActivityStatus()
        }
        if (
            request.type === "set-enabled" &&
            typeof request.enabled === "boolean"
        ) {
            const enabled = request.enabled
            if (!enabled) {
                for (const controller of pageReports) {
                    controller.abort()
                }
            }
            return await queueChange(() => setEnabled(enabled))
        }
        return disabled
    } catch {
        return { enabled: false, message: "无法读取或保存统计设置，请重试。" }
    }
}
