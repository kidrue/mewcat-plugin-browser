// @vitest-environment jsdom
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ query: vi.fn(), identity: vi.fn() }))
vi.mock("@/services/analytics", () => ({
    queryAnalytics: mocks.query,
    getAnalyticsIdentity: mocks.identity
}))
const act = (
    React as typeof React & {
        unstable_act: typeof import("react-dom/test-utils").act
    }
).unstable_act
let root: Root
beforeEach(() => {
    Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: true,
        chrome: { runtime: { getURL: (path: string) => path } }
    })
    document.body.innerHTML = '<div id="host"></div>'
    root = createRoot(document.getElementById("host")!)
    mocks.query.mockReset()
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
})
describe("管理员分析入口和页面", () => {
    it.each([
        "37156ad6-e1c6-4628-8ec3-55b329f4f1a3",
        "76aa2488-3241-4f38-b0a6-4f5df933417b"
    ])("在作者设备 %s 的完整与缩略 ID 旁标记 kidrue", async clientId => {
        const { DeviceId } = await import("../src/options/analytics/DeviceId")
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
        const { DeviceId } = await import("../src/options/analytics/DeviceId")
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
            const { Analytics } = await import("../src/options/Analytics")
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
        const { Analytics } = await import("../src/options/Analytics")
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
        const { Analytics } = await import("../src/options/Analytics")
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
        await act(async () => button("查看该设备调用记录").click())
        expect(document.querySelector("dialog")).toBeNull()
        expect(mocks.query.mock.lastCall?.[0]).toMatchObject({
            operation: "calls",
            clientId: id
        })
    })
    it("作者是键盘可用的隐藏入口，analytics hash 可恢复", async () => {
        const { AuthorAnalyticsEntry, resolveOptionsTab } = await import(
            "../src/options/analytics/navigation"
        )
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
        const { Analytics } = await import("../src/options/Analytics")
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
        const { Analytics } = await import("../src/options/Analytics")
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
