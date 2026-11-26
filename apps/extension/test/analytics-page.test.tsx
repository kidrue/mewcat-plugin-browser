// @vitest-environment jsdom
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    identity: vi.fn(),
    deviceActivity: vi.fn()
}))
vi.mock("@/services/analytics", () => ({
    queryAnalytics: mocks.query,
    getAnalyticsIdentity: mocks.identity
}))
vi.mock("@/messaging", () => ({ sendMessage: mocks.deviceActivity }))
const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act
let root: Root
const overview = {
    operation: "overview",
    asOf: "2026-11-05T00:00:00Z",
    coverage: {
        earliestObservedDay: "2026-11-01",
        aggregateComplete: false,
        callsComplete: false
    },
    totals: {
        requests: "2",
        successes: "2",
        failures: "0",
        successRate: 1,
        characters: "5",
        averageDurationMs: 100,
        promptTokens: "0",
        completionTokens: "0"
    },
    activeDevices: 1,
    days: [],
    languages: [],
    errors: [],
    p95DurationMs: null,
    p95UnavailableReason: null,
    analysis: {
        captureContent: false,
        autoAnalyze: false,
        completed: 0,
        coverage: null,
        jobs: []
    }
}
beforeEach(() => {
    Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: true,
        chrome: { runtime: { getURL: (path: string) => path } }
    })
    document.body.innerHTML = '<div id="host"></div>'
    root = createRoot(document.getElementById("host")!)
    mocks.query.mockReset()
    mocks.deviceActivity.mockReset().mockResolvedValue({
        success: false,
        message: "设备使用统计暂不可用"
    })
    mocks.identity.mockReset().mockResolvedValue({
        success: true,
        data: {
            clientId: "8f7ce4a1-1111-4321-8011-111111111111",
            serviceOrigin: "https://test.local"
        }
    })
})
afterEach(async () => {
    await act(async () => root.unmount())
    vi.restoreAllMocks()
})
describe("管理员分析入口和页面", () => {
    it("切换统计日期后只显示当前日期的设备用量", async () => {
        vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-25"))
        let resolveOld!: (value: unknown) => void
        mocks.query.mockResolvedValue({ success: true, data: overview })
        const activity = {
            operation: "overview",
            installs: 5,
            uninstalls: 1,
            activeDevices: 4,
            firstTranslationDevices: 3,
            pages: 17,
            days: [
                {
                    day: "2026-11-04",
                    installs: 5,
                    uninstalls: 1,
                    activeDevices: 4,
                    firstTranslationDevices: 3,
                    pages: 17
                }
            ]
        }
        mocks.deviceActivity
            .mockReturnValueOnce(new Promise(resolve => (resolveOld = resolve)))
            .mockResolvedValue({ success: true, data: activity })
        const { Analytics } = await import("../src/pages/options/Analytics")
        await act(async () => root.render(<Analytics />))
        const button = (label: string) =>
            [...document.querySelectorAll("button")].find(
                element => element.textContent === label
            )!
        const oldRequestId = mocks.deviceActivity.mock.lastCall?.[1].requestId
        await act(async () => button("近 30 天").click())
        expect(mocks.deviceActivity).toHaveBeenCalledWith("analytics-cancel", {
            requestId: oldRequestId
        })
        expect(mocks.deviceActivity.mock.lastCall).toEqual([
            "device-activity-query",
            {
                requestId: expect.any(String),
                query: mocks.query.mock.lastCall?.[0]
            }
        ])
        const section = document.querySelector('[aria-label="设备使用统计"]')!
        expect(section.textContent).toContain("设备平均翻译页数4.3")
        expect(section.textContent).toContain(
            "仅从 2026-11-04（UTC）起有统计覆盖"
        )
        await act(async () =>
            resolveOld({ success: true, data: { ...activity, pages: 100 } })
        )
        expect(section.textContent).toContain("设备平均翻译页数4.3")
        await act(async () => button("安装与卸载").click())
        expect(button("安装与卸载").getAttribute("aria-pressed")).toBe("true")
        expect(
            [...section.querySelectorAll("tbody tr td")].map(
                cell => cell.textContent
            )
        ).toEqual(["2026-11-04", "5", "1", "4", "3", "17"])
    })

    it("设备用量接口不可用时仍可读取原有概览", async () => {
        mocks.query.mockResolvedValue({ success: true, data: overview })
        const { Analytics } = await import("../src/pages/options/Analytics")
        await act(async () => root.render(<Analytics />))
        const section = document.querySelector('[aria-label="设备使用统计"]')
        expect(section?.textContent).toContain("设备使用统计暂不可用")
        expect(section?.querySelector("strong")).toBeNull()
        expect(document.body.textContent).toContain("翻译与生成调用")
    })

    it("提示所选日期无统计覆盖，不显示零值指标", async () => {
        mocks.query.mockResolvedValue({ success: true, data: overview })
        mocks.deviceActivity.mockResolvedValue({
            success: true,
            data: {
                operation: "overview",
                installs: 0,
                uninstalls: 0,
                activeDevices: 0,
                firstTranslationDevices: 0,
                pages: 0,
                days: []
            }
        })
        const { Analytics } = await import("../src/pages/options/Analytics")
        await act(async () => root.render(<Analytics />))
        const section = document.querySelector('[aria-label="设备使用统计"]')
        expect(section?.textContent).toContain("超出设备使用统计的覆盖范围")
        expect(section?.querySelector("strong")).toBeNull()
    })

    it.each([
        "37156ad6-e1c6-4628-8ec3-55b329f4f1a3",
        "76aa2488-3241-4f38-b0a6-4f5df933417b"
    ])("在作者设备 %s 的完整与缩略 ID 旁标记 kidrue", async clientId => {
        const { DeviceId } = await import(
            "../src/components/Analytics"
        )
        await act(async () =>
            root.render(
                <>
                    <DeviceId clientId={clientId} />
                    <DeviceId clientId={clientId} truncated />
                </>
            )
        )
        expect(
            document.querySelectorAll('[aria-label="作者 kidrue 的设备"]')
        ).toHaveLength(2)
        expect(document.body.textContent).toContain(clientId)
        expect(document.body.textContent).toContain(
            `${clientId.slice(0, 8)}…${clientId.slice(-4)}`
        )
    })

    it("不将普通设备或未认证记录标记为作者设备", async () => {
        const { DeviceId } = await import(
            "../src/components/Analytics"
        )
        await act(async () =>
            root.render(
                <>
                    <DeviceId clientId="8f7ce4a1-1111-4321-8011-111111111111" />
                    <DeviceId clientId={null} />
                </>
            )
        )
        expect(
            document.querySelector('[aria-label="作者 kidrue 的设备"]')
        ).toBeNull()
        expect(document.body.textContent).toContain("未认证")
    })

    it("作者标记不改变本设备 ID 的复制内容", async () => {
        const clientId = "76aa2488-3241-4f38-b0a6-4f5df933417b"
        mocks.identity.mockResolvedValue({
            success: true,
            data: { clientId, serviceOrigin: "https://test.local" }
        })
        mocks.query.mockResolvedValue({
            success: false,
            code: "ANALYTICS_FORBIDDEN",
            message: "当前设备尚未获得管理员权限"
        })
        const writeText = vi.fn().mockResolvedValue(undefined)
        const previousClipboard = Object.getOwnPropertyDescriptor(
            navigator,
            "clipboard"
        )
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText }
        })
        try {
            const { Analytics } = await import("../src/pages/options/Analytics")
            await act(async () => root.render(<Analytics />))
            expect(
                document.querySelector('[aria-label="作者 kidrue 的设备"]')
            ).not.toBeNull()
            await act(async () =>
                [...document.querySelectorAll("button")]
                    .find(button => button.textContent === "复制设备 ID")!
                    .click()
            )
            expect(writeText).toHaveBeenCalledExactlyOnceWith(clientId)
        } finally {
            if (previousClipboard)
                Object.defineProperty(navigator, "clipboard", previousClipboard)
            else Reflect.deleteProperty(navigator, "clipboard")
        }
    })

    it("下一页读取失败仍可返回上一页", async () => {
        mocks.query.mockResolvedValue({
            success: true,
            data: {
                operation: "devices",
                asOf: "2026-11-05T00:00:00Z",
                coverage: { earliestObservedDay: null },
                items: [],
                nextCursor: "next"
            }
        })
        const { Analytics } = await import("../src/pages/options/Analytics")
        await act(async () => root.render(<Analytics />))
        await act(async () =>
            (
                document.querySelector(
                    '[data-view="devices"]'
                ) as HTMLButtonElement
            ).click()
        )
        mocks.query.mockResolvedValueOnce({
            success: false,
            code: "NETWORK_FAILURE",
            message: "下一页失败"
        })
        await act(async () =>
            [...document.querySelectorAll("button")]
                .find(button => button.textContent === "下一页")!
                .click()
        )
        expect(document.body.textContent).toContain("下一页失败")
        const previous = [...document.querySelectorAll("button")].find(
            button => button.textContent === "上一页"
        )!
        expect(previous).toBeDefined()
        expect(previous.disabled).toBe(false)
        await act(async () => previous.click())
        expect(mocks.query.mock.lastCall?.[0]).not.toHaveProperty("cursor")
    })
    it("分页后切换筛选重置游标，画像可下钻设备调用记录", async () => {
        const id = "8f7ce4a1-1111-4321-8011-111111111111"
        const client = {
            id,
            name: "受控测试设备",
            createdAt: "2026-11-01T00:00:00Z",
            revokedAt: null
        }
        mocks.deviceActivity.mockResolvedValue({
            success: true,
            data: {
                operation: "profile",
                installedAt: "2026-11-02T00:00:00Z",
                uninstalledAt: null,
                lastTranslationAt: "2026-11-05T00:00:00Z",
                pagesLast7: 7,
                pagesLast30: 23
            }
        })
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
            configurable: true,
            value: function (this: HTMLDialogElement) {
                this.open = true
            }
        })
        Object.defineProperty(HTMLDialogElement.prototype, "close", {
            configurable: true,
            value: function (this: HTMLDialogElement) {
                this.open = false
            }
        })
        mocks.query.mockImplementation(async input => ({
            success: true,
            data:
                input.operation === "profile"
                    ? {
                          operation: "profile",
                          coverage: {
                              aggregateComplete: false,
                              callsComplete: false,
                              earliestObservedDay: "2026-11-05"
                          },
                          client,
                          asOf: "2026-11-05T00:00:00Z",
                          last7Days: { requests: "2", characters: "5" },
                          last30Days: { requests: "3", characters: "8" },
                          activeDaysLast7: 1,
                          activeDaysLast30: 2,
                          lastObservedCall: null,
                          languages: [],
                          errors: [],
                          activeHoursUtc: [],
                          topics: [],
                          keywords: [],
                          analysis: {
                              captureContent: false,
                              autoAnalyze: false,
                              completed: 0,
                              coverage: null,
                              jobs: []
                          }
                      }
                    : input.operation === "devices"
                      ? {
                            operation: "devices",
                            asOf: "2026-11-05T00:00:00Z",
                            coverage: { earliestObservedDay: null },
                            items: [
                                {
                                    client,
                                    requests: "3",
                                    characters: "8",
                                    lastObservedDay: "2026-11-05"
                                }
                            ],
                            nextCursor: input.cursor ? null : "page-two"
                        }
                      : {
                            operation: "calls",
                            asOf: "2026-11-05T00:00:00Z",
                            coverage: { earliestObservedDay: null },
                            items: [],
                            nextCursor: null
                        }
        }))
        const { Analytics } = await import("../src/pages/options/Analytics")
        await act(async () => root.render(<Analytics />))
        await act(async () =>
            (
                document.querySelector(
                    '[data-view="devices"]'
                ) as HTMLButtonElement
            ).click()
        )
        const button = (label: string) =>
            [...document.querySelectorAll("button")].find(
                element => element.textContent === label
            )!
        await act(async () => button("下一页").click())
        expect(mocks.query.mock.lastCall?.[0]).toMatchObject({
            operation: "devices",
            cursor: "page-two"
        })
        await act(async () => button("近 30 天").click())
        expect(mocks.query.mock.lastCall?.[0]).not.toHaveProperty("cursor")
        await act(async () => button("受控测试设备").click())
        expect(document.querySelector("dialog")?.open).toBe(true)
        expect(document.body.textContent).toContain("固定近 30 天画像")
        const activity = document.querySelector(
            'dialog [aria-label="设备使用统计"]'
        )
        expect(activity?.textContent).toContain("近 7 天翻译页面7")
        expect(activity?.textContent).toContain("近 30 天翻译页面23")
        expect(activity?.textContent).toContain("已确认卸载时间未收到回调")
        expect(mocks.deviceActivity.mock.lastCall).toEqual([
            "device-activity-query",
            {
                requestId: expect.any(String),
                query: { operation: "profile", clientId: id }
            }
        ])
        await act(async () => button("查看该设备调用记录").click())
        expect(document.querySelector("dialog")).toBeNull()
        expect(mocks.query.mock.lastCall?.[0]).toMatchObject({
            operation: "calls",
            clientId: id
        })
    })
    it("作者是键盘可用的隐藏入口，analytics hash 可恢复", async () => {
        const { AuthorAnalyticsEntry } = await import(
            "../src/components/Analytics"
        )
        const { resolveOptionsTab } = await import("../src/pages/options/navigation")
        await act(async () =>
            root.render(<AuthorAnalyticsEntry author="kidrue" />)
        )
        const button = document.querySelector("button")!
        expect(button.textContent).toBe("kidrue")
        await act(async () => button.click())
        expect(location.hash).toBe("#analytics")
        expect(resolveOptionsTab("#analytics")).toBe("analytics")
        expect(resolveOptionsTab("#missing")).toBe("basic")
    })
    it("未授权只显示本机 ID，不展示全站数据", async () => {
        mocks.query.mockResolvedValue({
            success: false,
            code: "ANALYTICS_FORBIDDEN",
            message: "当前设备尚未获得管理员权限"
        })
        const { Analytics } = await import("../src/pages/options/Analytics")
        await act(async () => root.render(<Analytics />))
        expect(document.body.textContent).toContain(
            "当前设备尚未获得管理员权限"
        )
        expect(document.body.textContent).toContain(
            "8f7ce4a1-1111-4321-8011-111111111111"
        )
        expect(document.body.textContent).not.toContain("翻译调用")
    })
    it("旧请求晚返回不会覆盖新筛选，错误刷新保留旧数据的更新时间", async () => {
        let resolveOld!: (value: unknown) => void
        mocks.query
            .mockReturnValueOnce(
                new Promise(resolve => {
                    resolveOld = resolve
                })
            )
            .mockResolvedValue({
                success: true,
                data: {
                    operation: "devices",
                    asOf: "2026-11-05T00:00:00Z",
                    coverage: { earliestObservedDay: null },
                    items: [],
                    nextCursor: null
                }
            })
        const { Analytics } = await import("../src/pages/options/Analytics")
        await act(async () => root.render(<Analytics />))
        await act(async () =>
            (
                document.querySelector(
                    '[data-view="devices"]'
                ) as HTMLButtonElement
            ).click()
        )
        expect(document.body.textContent).toContain("暂无设备记录")
        await act(async () =>
            resolveOld({
                success: false,
                code: "NETWORK_FAILURE",
                message: "过期错误"
            })
        )
        expect(document.body.textContent).not.toContain("过期错误")
        mocks.query.mockResolvedValueOnce({
            success: false,
            code: "NETWORK_FAILURE",
            message: "刷新失败"
        })
        await act(async () =>
            (
                document.querySelector(
                    '[data-action="refresh"]'
                ) as HTMLButtonElement
            ).click()
        )
        expect(document.body.textContent).toContain("刷新失败")
        expect(document.body.textContent).toContain("暂无设备记录")
        expect(document.body.textContent).toContain("最近成功更新")
    })
})
