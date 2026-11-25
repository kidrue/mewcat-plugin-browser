import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ activity: vi.fn(), query: vi.fn() }))
vi.mock("@/background/lib/mewcat-service", () => ({
    mewCatService: {
        deviceActivity: api.activity,
        queryDeviceActivity: api.query
    }
}))

const options = { id: "test", url: "chrome-extension://test/options.html" }
const page = {
    id: "test",
    url: "https://example.com/read?secret=1#section",
    frameId: 0,
    tab: { id: 42, url: "https://ignored.example/" } as chrome.tabs.Tab
}
const uninstallPath = "/v1/activity/uninstall/abcdefghijklmnopqrstuvwxyz012345"
const state: Record<string, unknown> = {}
let uninstallUrl = ""

beforeEach(() => {
    for (const key of Object.keys(state)) delete state[key]
    uninstallUrl = ""
    api.activity.mockReset().mockImplementation(async input => ({
        enabled: input.operation !== "disable",
        revision: input.revision,
        uninstallPath: input.operation === "enable" ? uninstallPath : null
    }))
    api.query.mockReset()
    vi.stubGlobal("chrome", {
        runtime: {
            id: "test",
            getURL: (path: string) => `chrome-extension://test/${path}`,
            setUninstallURL: async (url: string) => {
                uninstallUrl = url
            }
        },
        storage: {
            local: {
                get: async (key: string) => ({ [key]: state[key] }),
                set: async (items: Record<string, unknown>) => {
                    Object.assign(state, items)
                }
            }
        }
    })
})

afterEach(() => vi.unstubAllGlobals())

describe("设备活动统计", () => {
    it("记录首次安装后仍默认关闭，只有选项页能开启统计", async () => {
        const { handleDeviceActivity, noteDeviceActivityInstall } =
            await import("../src/background/messages/device-activity")
        await noteDeviceActivityInstall("install")
        expect(
            await handleDeviceActivity({ type: "get-status" }, options)
        ).toEqual({
            enabled: false
        })
        await handleDeviceActivity({ type: "page-translated" }, page)
        await handleDeviceActivity({ type: "set-enabled", enabled: true }, page)
        expect(api.activity).not.toHaveBeenCalled()

        expect(
            await handleDeviceActivity(
                { type: "set-enabled", enabled: true },
                options
            )
        ).toEqual({ enabled: true })
        expect(api.activity.mock.calls[0][0]).toEqual({
            operation: "enable",
            revision: 1,
            newInstall: true
        })
        expect(uninstallUrl).toBe(
            `https://api.mewcat.kidrue.top${uninstallPath}`
        )
    })

    it("更新扩展后首次开启也不计为新安装", async () => {
        const { handleDeviceActivity, noteDeviceActivityInstall } =
            await import("../src/background/messages/device-activity")
        await noteDeviceActivityInstall("update")
        await handleDeviceActivity(
            { type: "set-enabled", enabled: true },
            options
        )
        expect(api.activity.mock.calls[0][0]).toEqual({
            operation: "enable",
            revision: 1,
            newInstall: false
        })
    })

    it("仅发送顶层普通网页的本地盐化标识，忽略查询和片段", async () => {
        const { handleDeviceActivity } = await import(
            "../src/background/messages/device-activity"
        )
        await handleDeviceActivity(
            { type: "set-enabled", enabled: true },
            options
        )
        await handleDeviceActivity(
            { type: "page-translated" },
            { ...page, frameId: 1 }
        )
        await handleDeviceActivity(
            { type: "page-translated" },
            {
                ...page,
                url: "chrome://settings"
            }
        )
        await handleDeviceActivity({ type: "page-translated" }, page)
        await handleDeviceActivity(
            { type: "page-translated" },
            {
                ...page,
                url: "http://example.com/read?other=2#another"
            }
        )
        const data = api.activity.mock.calls.slice(1).map(([input]) => input)
        expect(data).toHaveLength(2)
        const first = data[0]
        expect(first).toEqual({
            operation: "page",
            revision: 1,
            eventId: expect.stringMatching(/^[a-f0-9-]{36}$/),
            pageKey: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
        expect(data[1].eventId).not.toBe(first.eventId)
        expect(data[1].pageKey).toBe(first.pageKey)
    })

    it("网络失败时仍立即关闭统计并清除回调，随后重试删除", async () => {
        const { handleDeviceActivity } = await import(
            "../src/background/messages/device-activity"
        )
        await handleDeviceActivity(
            { type: "set-enabled", enabled: true },
            options
        )
        api.activity.mockRejectedValueOnce(new Error("network failure"))
        expect(
            await handleDeviceActivity(
                { type: "set-enabled", enabled: false },
                options
            )
        ).toMatchObject({ enabled: false, message: expect.any(String) })
        expect(uninstallUrl).toBe("")
        await handleDeviceActivity({ type: "page-translated" }, page)
        expect(
            api.activity.mock.calls.map(([input]) => input.operation)
        ).toEqual(["enable", "disable"])
        expect(
            await handleDeviceActivity({ type: "get-status" }, options)
        ).toEqual({ enabled: false })
        expect(api.activity.mock.calls[2][0]).toEqual({
            operation: "disable",
            revision: 2
        })
    })

    it("拒绝服务返回的外部卸载地址并撤回启用", async () => {
        const { handleDeviceActivity } = await import(
            "../src/background/messages/device-activity"
        )
        api.activity.mockResolvedValueOnce({
            enabled: true,
            revision: 1,
            uninstallPath: "https://external.example/private"
        })
        expect(
            await handleDeviceActivity(
                { type: "set-enabled", enabled: true },
                options
            )
        ).toMatchObject({ enabled: false, message: expect.any(String) })
        expect(uninstallUrl).toBe("")
        expect(api.activity.mock.calls[1][0]).toEqual({
            operation: "disable",
            revision: 2
        })
    })

    it("撤回同意会中止正在上报的页面事件", async () => {
        const { handleDeviceActivity } = await import(
            "../src/background/messages/device-activity"
        )
        await handleDeviceActivity(
            { type: "set-enabled", enabled: true },
            options
        )
        let notifyStarted!: () => void
        const started = new Promise<void>(resolve => (notifyStarted = resolve))
        api.activity.mockImplementationOnce((_input, signal: AbortSignal) => {
            notifyStarted()
            return new Promise((_resolve, reject) => {
                signal.addEventListener("abort", () => reject(signal.reason), {
                    once: true
                })
            })
        })
        const reporting = handleDeviceActivity(
            { type: "page-translated" },
            page
        )
        await started
        await handleDeviceActivity(
            { type: "set-enabled", enabled: false },
            options
        )
        await expect(reporting).resolves.toEqual({ enabled: false })
        expect(uninstallUrl).toBe("")
    })

    it("服务端关闭统计后同步关闭本机上报和卸载回调", async () => {
        const { handleDeviceActivity } = await import(
            "../src/background/messages/device-activity"
        )
        await handleDeviceActivity(
            { type: "set-enabled", enabled: true },
            options
        )
        api.activity.mockResolvedValueOnce({
            enabled: false,
            revision: 7,
            uninstallPath: null
        })
        await handleDeviceActivity({ type: "page-translated" }, page)
        expect(
            await handleDeviceActivity({ type: "get-status" }, options)
        ).toEqual({ enabled: false })
        expect(uninstallUrl).toBe("")
        await handleDeviceActivity({ type: "page-translated" }, page)
        expect(
            api.activity.mock.calls.map(([input]) => input.operation)
        ).toEqual(["enable", "page"])
        await handleDeviceActivity(
            { type: "set-enabled", enabled: true },
            options
        )
        expect(api.activity.mock.lastCall?.[0]).toMatchObject({
            operation: "enable",
            revision: 8
        })
    })

    it("服务端版本更新时不提前确认删除，重试使用更高版本", async () => {
        const { handleDeviceActivity } = await import(
            "../src/background/messages/device-activity"
        )
        await handleDeviceActivity(
            { type: "set-enabled", enabled: true },
            options
        )
        api.activity.mockResolvedValueOnce({
            enabled: false,
            revision: 7,
            uninstallPath: null
        })
        expect(
            await handleDeviceActivity(
                { type: "set-enabled", enabled: false },
                options
            )
        ).toMatchObject({ enabled: false, message: expect.any(String) })
        expect(api.activity.mock.lastCall?.[0]).toEqual({
            operation: "disable",
            revision: 2
        })
        expect(
            await handleDeviceActivity({ type: "get-status" }, options)
        ).toEqual({ enabled: false })
        expect(api.activity.mock.lastCall?.[0]).toEqual({
            operation: "disable",
            revision: 8
        })
    })

    it("过期的启用响应保留新版本以供用户再次启用", async () => {
        const { handleDeviceActivity } = await import(
            "../src/background/messages/device-activity"
        )
        api.activity.mockResolvedValueOnce({
            enabled: true,
            revision: 7,
            uninstallPath: null
        })
        expect(
            await handleDeviceActivity(
                { type: "set-enabled", enabled: true },
                options
            )
        ).toMatchObject({ enabled: false, message: expect.any(String) })
        expect(uninstallUrl).toBe("")
        expect(api.activity).toHaveBeenCalledTimes(1)
        expect(
            await handleDeviceActivity(
                { type: "set-enabled", enabled: true },
                options
            )
        ).toEqual({ enabled: true })
        expect(api.activity.mock.lastCall?.[0]).toMatchObject({
            operation: "enable",
            revision: 8
        })
    })

    it("撤回响应丢失的启用时不会清除较新的授权", async () => {
        const { handleDeviceActivity } = await import(
            "../src/background/messages/device-activity"
        )
        api.activity
            .mockRejectedValueOnce(new Error("response lost"))
            .mockResolvedValueOnce({
                enabled: true,
                revision: 7,
                uninstallPath: null
            })
        await handleDeviceActivity(
            { type: "set-enabled", enabled: true },
            options
        )
        expect(api.activity.mock.lastCall?.[0]).toEqual({
            operation: "disable",
            revision: 2
        })
        expect(
            await handleDeviceActivity({ type: "get-status" }, options)
        ).toEqual({ enabled: false })
        expect(api.activity).toHaveBeenCalledTimes(2)
        await handleDeviceActivity(
            { type: "set-enabled", enabled: true },
            options
        )
        expect(api.activity.mock.lastCall?.[0]).toMatchObject({
            operation: "enable",
            revision: 8
        })
    })

    it("管理查询只接受选项页发送的已验证条件", async () => {
        const { handleDeviceActivityQuery } = await import(
            "../src/background/messages/analytics"
        )
        const query = {
            operation: "overview",
            from: "2026-11-01",
            to: "2026-11-24"
        }
        const message = { requestId: crypto.randomUUID(), query }
        expect(await handleDeviceActivityQuery(message, page)).toMatchObject({
            success: false
        })
        expect(
            await handleDeviceActivityQuery(
                { ...message, query: { ...query, to: "9999-01-01" } },
                options
            )
        ).toMatchObject({ success: false })
        expect(api.query).not.toHaveBeenCalled()

        const data = {
            operation: "overview",
            installs: 3,
            uninstalls: 1,
            activeDevices: 2,
            firstTranslationDevices: 1,
            pages: 4,
            days: []
        }
        api.query.mockResolvedValue(data)
        expect(await handleDeviceActivityQuery(message, options)).toEqual({
            success: true,
            data
        })
        expect(api.query).toHaveBeenCalledWith(query, expect.any(AbortSignal))
    })
})
