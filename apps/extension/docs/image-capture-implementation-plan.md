# 图片抓取落地方案（防盗链 + 高质量 + 低兜底率）

## 1. 目标

- 优先获取原始分辨率图片，避免视口截图带来的裁剪误差和 UI 污染。
- 解决 pixiv 等站点防盗链导致的 `403/CORS` 抓图失败。
- 保留 `captureVisibleTab` 作为最后兜底，确保功能可用性。

---

## 2. 最终架构（分层抓图）

按优先级从高到低执行：

1. `direct-fetch`：background 直接 `fetch(imageUrl)` 抓图。
2. `anti-hotlink-fetch`：若命中防盗链失败，动态注入 DNR 规则（Referer/Origin）后重试。
3. `canvas-source-fetch`：对 canvas 站点注入 `drawImage` hook，提取源图 URL + 裁剪参数，再走 1/2。
4. `screenshot-fallback`：仅当前三层全部失败时，`captureVisibleTab + crop` 兜底。

核心原则：截图不是主路径，只是可用性兜底。

---

## 3. 与当前项目的对应关系

当前已有：

- 主流程与兜底在 `src/background/messages/translate-image.ts`。
- 现有兜底已实现 `captureVisibleTab + crop`。
- manifest 位于 `package.json` 的 `manifest` 字段。

本次主要增量：

- 增加 DNR 权限与动态规则编排。
- 在 `downloadImage` 失败链路中插入“防盗链重试层”。
- 增加可观测日志（抓图路径、失败原因、站点命中率）。
- 后续可选：加入 canvas hook（第二阶段）。

---

## 4. 详细实现方案

### 4.1 Manifest 权限

在 `package.json -> manifest.permissions` 新增：

- `declarativeNetRequest`
- `declarativeNetRequestWithHostAccess`

说明：

- 已有 `host_permissions: ["<all_urls>", ...]`，可满足跨域目标请求匹配。
- 不建议加 `declarativeNetRequestFeedback`（调试阶段可临时开启）。

### 4.2 DNR 动态规则管理模块

新增文件建议：

- `src/background/lib/dnr-hotlink.ts`

职责：

- `buildHotlinkRule({ ruleId, requestDomain, referer, origin? })`
- `installHotlinkRule(rule)`
- `removeHotlinkRule(ruleId)`
- `withTemporaryHotlinkRule(config, fn)`：包裹式安装/执行/卸载，确保 finally 清理。

规则建议：

- 只改 `xmlhttprequest`（或扩展到 `image`，按实际抓图路径）。
- `urlFilter` 精确到目标域名，不做全局。
- 按站点白名单配置 Referer/Origin。

### 4.3 防盗链站点配置

新增文件建议：

- `src/background/config/hotlink-sites.ts`

示例结构：

```ts
export interface HotlinkSiteRule {
  match: RegExp
  referer: string
  origin?: string
}

export const HOTLINK_SITE_RULES: HotlinkSiteRule[] = [
  { match: /(^|\.)pximg\.net$/i, referer: "https://www.pixiv.net/" }
]
```

辅助函数：

- `resolveHotlinkHeaders(imageUrl: string): { referer; origin? } | null`

### 4.4 修改抓图流程（核心）

修改 `src/background/messages/translate-image.ts`：

1. 保留现有 `downloadImage` 为第一层。
2. 在 `downloadImage` 抛出 `403/401/非图片响应` 时：
   - 调用 `resolveHotlinkHeaders(imageUrl)`；
   - 若命中，执行 `withTemporaryHotlinkRule(..., () => downloadImage(imageUrl))`；
   - 成功则进入翻译 API，不再走截图兜底。
3. 若仍失败，再进入现有 `captureAndCropImage`。

状态记录建议：

- `fetchPath`: `direct-fetch | anti-hotlink-fetch | screenshot-fallback`
- `site`: 主域名
- `errorCode`: HTTP 状态码或内部错误码

### 4.5 并发与清理策略

问题：多个图片并发翻译时，动态规则 ID 可能冲突。

方案：

- 规则 ID 采用递增池（例如 `10_000 + counter`）或哈希域名 + 时间戳。
- `withTemporaryHotlinkRule` 必须 `try/finally` 清理。
- 设置超时保护，异常也能执行 `removeDynamicRules`。

### 4.6 Canvas Hook（二阶段）

第一阶段先不上，避免复杂度爆炸。二阶段再加：

- 在 `content` 注入 `drawImage` hook（类似 Immersive 方案）。
- 对 manga/canvas 站点提取源图 URL + 变换参数，回传 background 下载。
- 这样可进一步降低 screenshot 命中率。

---

## 5. 错误处理策略

- `404`：接口路径问题，不走 DNR，直接报 API 配置错误。
- `401`：token 刷新重试（现有逻辑保留）。
- `403`：优先判定防盗链，命中则 DNR 重试。
- `200 + text/html`：视作防盗链/反爬页面，允许进入 DNR 重试。
- DNR 重试失败：进入截图兜底。

---

## 6. 验收标准（DoD）

- pixiv 图片翻译成功率显著提升（主路径不依赖截图）。
- 在滚动场景下，不再频繁出现“截不全/图标被截入”问题。
- 常规站点无回归（直接抓图仍可用）。
- 动态规则无泄漏（结束后规则数回到基线）。
- 失败时仍可通过截图兜底完成翻译。

---

## 7. 测试计划

### 7.1 功能测试

- 普通公开图床：应走 `direct-fetch`。
- pixiv 原图链接：应走 `anti-hotlink-fetch` 成功。
- 非图片 URL：应报错并可回退兜底策略。
- 长页面滚动后点击翻译：优先非截图路径，失败才兜底。

### 7.2 稳定性测试

- 并发 5~10 张图片翻译，确认规则无冲突和泄漏。
- 中途取消/页面关闭，确认规则被清理。
- 频繁触发（50 次）后内存与日志稳定。

### 7.3 观测指标

- 各抓图路径命中率。
- DNR 重试成功率。
- screenshot 兜底比例（目标持续下降）。

---

## 8. 实施节奏

### Phase 1（本周可交付）

- 权限改造 + DNR 动态规则 + `translate-image.ts` 主流程接入 + 日志。

### Phase 2（后续增强）

- canvas hook + 源图裁剪参数通道 + 站点特化优化。

---

## 9. 风险与边界

- 个别站点除 Referer 外还校验更复杂指纹，DNR 不一定 100%。
- 站点策略会变，需要可配置白名单和灰度开关。
- 截图兜底仍需保留，不能完全删除。

---

## 10. 结论

最佳落地方案是“分层抓图”而非“只用截图”或“只用 DNR”：

- `background 原图抓取` 作为主路径；
- `DNR 伪造 Referer/Origin` 作为防盗链增强层；
- `captureVisibleTab` 仅作为最后兜底。

该方案在实现成本、成功率、维护性之间平衡最好，并与当前项目结构兼容。
