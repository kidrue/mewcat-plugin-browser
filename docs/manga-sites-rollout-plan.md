# 漫画站点兼容落地方案（修订版）

## 1. 结论与原则

评审结论采纳：先做低风险高收益（规则同步 + 多候选重试），再做 canvas PoC，最后再决定大范围推广。

执行原则：

- 主路径始终是原图抓取；截图仅作为最后兜底。
- 对 canvas 方案设置技术闸门（PoC 通过才进入量产）。
- 规则系统必须可校验、可回归、可持续同步。

---

## 2. 实施顺序（按优先级）

### Phase A（2-3 天）：规则同步 + 多候选 anti-hotlink

目标：不改前端复杂链路，先提升覆盖率。

包含内容：

1. 规则同步脚本落地（从 `assets/request_modifier_rule.json` 生成本地规则）。
2. `downloadImageWithHotlinkRetry` 升级为多候选重试。
3. 增加基础埋点（至少可产出 fetchPath/failureType 基线）。

### Phase B（5 天）：canvas PoC（仅 1-2 个站点）

目标：验证 Main World 注入和跨 world 通信可行性，不做大范围接入。

首批 PoC 站点：

- `shonenjumpplus.com`
- `comic-growl.com`

明确不放入首批：

- `lezhin.com`（存在 WebGL 渲染风险，先排除）

### Phase C（2-4 天）：按 PoC 结果扩展

只有在 Phase B 通过后才做：

- 扩展 canvas 站点名单
- UI 层 canvas 触发体验完善
- 站点级灰度与回滚

---

## 3. 关键设计（修订后）

### 3.1 Main World 注入方案（P0 补齐）

要求：

- `drawImage` hook 必须运行在 Main World。
- Main World 不能直接调用 `chrome.runtime`。

方案：

1. 由 background 通过 `chrome.scripting.executeScript({ world: "MAIN" })` 注入 hook（仅命中站点注入）。  
2. Main World 与 Isolated World 通过 `window.postMessage` + channel 协议通信。  
3. Isolated World 负责转发给 background（`sendToBackground`）。  
4. 注入脚本必须带版本号和幂等标记，避免重复 hook。  

通信协议建议：

- `channel`: `doc2x-canvas-hook`
- `type`: `CANVAS_META_UPDATE | CANVAS_META_QUERY | CANVAS_META_RESPONSE | CANVAS_META_ERROR`
- `requestId`: string（请求响应匹配）

错误传播要求：

1. Main World hook 抛错时发送 `CANVAS_META_ERROR`（包含 `requestId`、`code`、`message`、`stack?`）。  
2. Isolated World 原样转发到 background，并打点 `renderType` 与 `hookStage`。  
3. background 收到错误后直接降级到现有抓图链路，不中断用户点击流程。  

CSP 策略：

- 禁止依赖页面内联脚本执行。
- 优先使用 `chrome.scripting.executeScript` Main World 注入，减少页面 CSP 干扰。

### 3.2 WebGL/OffscreenCanvas 限制（P0 补齐）

结论：

- `CanvasRenderingContext2D.drawImage` hook 对 WebGL/OffscreenCanvas 不可靠或无效。

执行策略：

- PoC 阶段加入渲染类型探测：2D / WebGL / OffscreenCanvas。
- 若非 2D 路径，直接走现有抓图链路（不阻塞功能）。
- 文档和代码都要标注“仅保证 2D canvas 主路径”。

探测实现（必须按此执行）：

- 不使用 `canvas.getContext("2d")` 进行探测试调用。
- 在 Main World hook `HTMLCanvasElement.prototype.getContext`，记录每个 canvas 实际获取的 context 类型（`2d`/`webgl`/`webgl2`/`bitmaprenderer`）。
- 同时记录 `drawImage` 元数据来源 canvas 的 context 类型，作为后续路由依据。

### 3.3 规则同步与校验（P0/P1 补齐）

新增脚本：

- `scripts/sync-hotlink-sites-from-immersive.ts`

新增测试：

- `test/hotlink-rules/sync.spec.ts`

规则处理要求：

1. 只提取 `modifyHeaders.requestHeaders` 中 `referer`（可选 `origin`）。  
2. 对输入 `urlFilter` 做语法校验；不可解析规则直接跳过并输出告警。  
3. 明确过滤已知无效样例（例如 id 311 的正则式 OR 写法）。  
4. 生成结果输出到 `src/background/config/hotlink-sites.generated.ts`。  

注意：

- 不做“DNR urlFilter 全语义 -> JS 正则”的强行转换。
- 采用“可解释子集 + 显式跳过”策略，保证稳定性。

### 3.4 pageUrl 冲突策略与多候选接口（P1 补齐）

请求模型新增：

- `TranslateImageRequest.pageUrl?: string`

规则模型新增：

- `pageHostAllowList?: string[]`
- `priority?: number`

核心接口调整（Phase A 必做）：

1. 新增 `resolveAllHotlinkHeaders(input): HotlinkCandidate[]`，返回候选列表（多条）。  
2. 旧 `resolveHotlinkHeaders()` 保留为兼容包装器，仅返回 `resolveAllHotlinkHeaders()[0] ?? null`。  
3. `downloadImageWithHotlinkRetry` 必须遍历候选列表，逐条安装临时 DNR 规则并重试。  

建议类型：

```ts
interface HotlinkCandidate {
    referer: string
    origin?: string
    ruleKey: string
    source: "manual" | "generated"
    priority: number
    pageHostAllowList?: string[]
}
```

匹配优先级（从高到低）：

1. 手工 override 规则（最高优先级，存在即优先）。
2. `imageHost + pageHost` 双命中规则。
3. `imageHost` 单命中规则。
4. 失败后截图兜底（受错误码门限控制）。

同 host 冲突策略：

- `manual override > generated`
- 同来源冲突时 `priority` 高者优先；相同则后定义覆盖前定义。

### 3.5 CI 与新鲜度约束（P1 补齐）

新增命令：

- `pnpm sync:hotlink-rules`
- `pnpm check:hotlink-rules`

CI 增加检查：

1. 先执行 `pnpm sync:hotlink-rules`
2. 再执行 `git diff --exit-code src/background/config/hotlink-sites.generated.ts`
3. 有差异即失败（防止忘记同步）

### 3.6 UI 层改造（P2 补齐）

文件：

- `src/contents/imageTranslate.tsx`

改动点：

1. 触发元素从“仅 IMG”扩展到“IMG + CANVAS”。  
2. 对 canvas 提供与 img 一致的按钮展示与点击路径。  
3. 当 canvas 元数据缺失时，按钮仍可触发兜底流程（不中断交互）。  
4. `validateImage` 升级为支持 canvas：
   - `img`: `complete && naturalWidth >= 50 && naturalHeight >= 50`
   - `canvas`: `width >= 50 && height >= 50`

### 3.7 类型收敛（P2 补齐）

`FetchPath` 必须预留 canvas 主路径值：

```ts
type FetchPath =
    | "direct-fetch"
    | "anti-hotlink-fetch"
    | "canvas-rebuild-fetch"
    | "screenshot-fallback"
```

要求：

- Phase A 可先不产出 `canvas-rebuild-fetch`，但类型需提前兼容。
- Phase B 上线时必须打出该路径埋点，避免与 `anti-hotlink-fetch` 混淆。

---

## 4. 具体改动清单

Phase A 必改文件：

- `src/background/config/hotlink-sites.ts`（合并 generated + manual）
- `src/background/config/hotlink-sites.generated.ts`（自动生成）
- `src/background/messages/translate-image.ts`（多候选重试 + pageUrl）
- `src/contents/imageTranslate.tsx`（请求体附带 pageUrl）
- `src/services/imageTranslation.ts`（`validateImage` 扩展到 IMG + CANVAS）
- `scripts/sync-hotlink-sites-from-immersive.ts`
- `package.json`（新增 scripts）

Phase B PoC 文件：

- `src/background/messages/inject-main-world-hook.ts`（或并入现有消息）
- `src/contents/bridges/canvas-hook-bridge.ts`
- `src/contents/inject/canvas-image-hook.ts`
- `src/background/config/canvas-sites.ts`

---

## 5. 验收标准（DoD）

Phase A DoD：

- Pixiv 和已纳入规则站点的 `anti-hotlink-fetch` 命中率提升。
- `screenshot-fallback` 占比相对基线下降。
- 规则同步可重复执行，CI 可阻断过时 generated 文件。

Phase B DoD（PoC）：

- 在 `shonenjumpplus.com` 至少 1 条阅读链路可稳定获取 canvas 源数据。
- Main World 注入和跨 world 通信稳定，无明显页面副作用。
- 非 2D canvas 场景可自动回退，不影响现有功能。

---

## 6. 观测与基线

最低埋点字段（先落本地可导出统计）：

- `site`
- `fetchPath`
- `failureType`
- `errorCode`
- `ruleHit`
- `renderType`（`img | canvas-2d | canvas-webgl | unknown`）

基线要求：

- Phase A 上线前先收集 1-2 天现状数据。
- 灰度期间与基线按站点对比，禁止只看 console 单点日志。

---

## 7. 风险与回滚

高风险项：

- Main World 注入兼容性
- canvas 站点渲染差异（WebGL/混合渲染）

回滚策略：

- 通过环境开关关闭 canvas hook：`WXT_ENABLE_CANVAS_REBUILD=false`
- 保留 anti-hotlink 主路径与截图兜底，确保功能不回退到不可用。

---

## 8. 最终执行口径

先交付 Phase A，再做 Phase B PoC。  
PoC 不通过，则不进入大规模 canvas 接入，仅继续迭代规则覆盖和 anti-hotlink 命中率。

---

## 9. 当前落地状态（2026-02-10）

- Phase A：已完成（规则同步、多候选 anti-hotlink、截图兜底收敛）。
- Phase B：已完成 PoC（Main World hook、跨 world 协议、canvas 元数据查询、错误通道）。
- Phase C：已完成首版落地：
- 站点级灰度：按 host 稳定分桶，支持全局灰度百分比 `WXT_CANVAS_ROLLOUT_PERCENT`。
- 回滚开关：`WXT_ENABLE_CANVAS_REBUILD=false` 可一键关闭 canvas 路径。
  - UI 体验：canvas 翻译结果改为原位 overlay 覆盖，再次点击可恢复原图。

### 9.1 默认开启站点

- `shonenjumpplus.com`
- `comic-growl.com`
- `championcross.jp`

### 9.2 后续建议

- 先按 10%-30% 灰度观察 `canvas-rebuild-fetch` 命中率和失败原因，再逐步放量。
- 若站点出现 WebGL/混合渲染不稳定，优先回滚到 `anti-hotlink + screenshot` 路径。
