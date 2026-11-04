// @vitest-environment jsdom
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ query: vi.fn(), identity: vi.fn() }))
vi.mock('@/services/analytics', () => ({ queryAnalytics: mocks.query, getAnalyticsIdentity: mocks.identity }))
const act = (React as typeof React & { unstable_act: typeof import('react-dom/test-utils').act }).unstable_act
let root: Root
beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, chrome: { runtime: { getURL: (path: string) => path } } })
    document.body.innerHTML = '<div id="host"></div>'
    root = createRoot(document.getElementById('host')!)
    mocks.query.mockReset(); mocks.identity.mockReset().mockResolvedValue({ success: true, data: { clientId: '8f7ce4a1-1111-4321-8011-111111111111', serviceOrigin: 'https://test.local' } })
})
afterEach(async () => { await act(async () => root.unmount()) })
describe('管理员分析入口和页面', () => {
    it('作者是键盘可用的隐藏入口，analytics hash 可恢复', async () => {
        const { AuthorAnalyticsEntry, resolveOptionsTab } = await import('../src/options/analytics/navigation')
        await act(async () => root.render(<AuthorAnalyticsEntry author="kidrue" />))
        const button = document.querySelector('button')!
        expect(button.textContent).toBe('kidrue')
        await act(async () => button.click())
        expect(location.hash).toBe('#analytics')
        expect(resolveOptionsTab('#analytics')).toBe('analytics')
        expect(resolveOptionsTab('#missing')).toBe('basic')
    })
    it('未授权只显示本机 ID，不展示全站数据', async () => {
        mocks.query.mockResolvedValue({ success: false, code: 'ANALYTICS_FORBIDDEN', message: '当前设备尚未获得管理员权限' })
        const { Analytics } = await import('../src/options/Analytics')
        await act(async () => root.render(<Analytics />))
        expect(document.body.textContent).toContain('当前设备尚未获得管理员权限')
        expect(document.body.textContent).toContain('8f7ce4a1-1111-4321-8011-111111111111')
        expect(document.body.textContent).not.toContain('翻译调用')
    })
    it('旧请求晚返回不会覆盖新筛选，错误刷新保留旧数据的更新时间', async () => {
        let resolveOld!: (value: unknown) => void
        mocks.query.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve })).mockResolvedValue({ success: true, data: { operation: 'devices', asOf: '2026-11-05T00:00:00Z', coverage: { earliestObservedDay: null }, items: [], nextCursor: null } })
        const { Analytics } = await import('../src/options/Analytics')
        await act(async () => root.render(<Analytics />))
        await act(async () => (document.querySelector('[data-view="devices"]') as HTMLButtonElement).click())
        expect(document.body.textContent).toContain('暂无设备记录')
        await act(async () => resolveOld({ success: false, code: 'NETWORK_FAILURE', message: '过期错误' }))
        expect(document.body.textContent).not.toContain('过期错误')
        mocks.query.mockResolvedValueOnce({ success: false, code: 'NETWORK_FAILURE', message: '刷新失败' })
        await act(async () => (document.querySelector('[data-action="refresh"]') as HTMLButtonElement).click())
        expect(document.body.textContent).toContain('刷新失败')
        expect(document.body.textContent).toContain('暂无设备记录')
        expect(document.body.textContent).toContain('最近成功更新')
    })
})
