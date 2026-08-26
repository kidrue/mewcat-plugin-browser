# 图片翻译实施报告（当前工作区）

## 2026-08-25：结构化视觉翻译与设置页

图片翻译现在使用独立的视觉模型配置，不再跟随文本翻译模型。使用前请在“模型”设置中配置并启用模型；自定义模型还需显式开启“支持图片输入”，然后在“图片翻译”设置中选择该模型。没有可用或已选视觉模型时，快捷翻译按钮和能力测试保持禁用，避免界面显示为可用但运行时必然失败。

设置页提供“测试视觉能力”：测试图片在点击时通过 Canvas 生成 data URL，不包含静态测试图片资源，并通过与页面图片翻译相同的严格 background 通道发送。页面设置代码只提交图片、目标语言和模型 ID，API Key 始终由 background 从扩展配置读取。

能力测试及实际图片翻译会将图片发送给所选模型服务商，并可能产生服务商费用。测试页会展示加载、成功和稳定的中文失败信息；认证、限流、超时、无文字及格式错误仍由严格 background 通道统一映射。

开发验证可运行：

```powershell
pnpm test:image
pnpm typecheck
```

以下内容保留为 2026-02-10 捕获管道重构的历史审查记录。

更新时间：2026-02-10 23:52 CST  
工作区：`/Users/cc/learn/SideTranslateBrowserPlugin`

---

## 1. 审查方法

本报告基于以下方式产出：

1. 使用 `git diff` 审阅已跟踪文件改动（含删改）。
2. 对所有 untracked 新增文件逐一阅读源码（配置、消息、注入脚本、文档、同步脚本）。
3. 结合本地验证命令结果（`pnpm typecheck` / `pnpm lint` / `pnpm check`）。

---

## 2. 变更范围总览

### 2.1 已跟踪文件（git diff）

- 修改：`.env.development`
- 修改：`package.json`
- 修改：`src/background/index.ts`
- 删除：`src/background/messages/download-image.ts`
- 删除：`src/components/ImageLoadingOverlay.tsx`
- 修改：`src/components/ImageTranslateButton.tsx`
- 修改：`src/components/index.ts`
- 修改：`src/contents/imageTranslate.tsx`
- 修改：`src/services/imageTranslation.ts`

`git diff --numstat`（已跟踪文件）统计：

- `src/contents/imageTranslate.tsx`: `+481/-111`
- `src/services/imageTranslation.ts`: `+129/-236`
- 其余为权限、索引、消息发送安全处理与删旧文件。

### 2.2 新增文件（untracked）

- `assets/request_modifier_rule.json`
- `scripts/sync-hotlink-sites-from-immersive.js`
- `src/background/config/canvas-sites.ts`
- `src/background/config/hotlink-sites.generated.ts`
- `src/background/config/hotlink-sites.ts`
- `src/background/lib/hotlink-dnr.ts`
- `src/background/messages/canvas-hook-event.ts`
- `src/background/messages/inject-main-world-hook.ts`
- `src/background/messages/translate-image.ts`
- `src/contents/bridges/canvas-hook-bridge.ts`
- `src/contents/inject/canvas-image-hook.ts`
- `src/types/canvas-hook.ts`
- `docs/image-capture-implementation-plan.md`
- `docs/manga-sites-rollout-plan.md`

---

## 3. 架构变化（实施后）

### 3.1 图片翻译链路从“前端处理”重构为“后台主导”

当前主链路：

1. Content script 识别 `IMG/CANVAS`，触发翻译请求。
2. `src/services/imageTranslation.ts` 通过 `translate-image` 消息把请求发给 background。
3. Background 在 `src/background/messages/translate-image.ts` 执行抓图与调用 API。
4. 返回翻译图 URL，前端执行替换（img）或 overlay（canvas）。

### 3.2 抓图策略升级为分层容错

`translate-image` 中实现了明确分层：

1. `direct-fetch`：background 直接拉图（主路径）。
2. `anti-hotlink-fetch`：按候选规则临时安装 DNR，注入 `referer/origin` 后重试。
3. `screenshot-fallback`：仅在受控错误场景（如 401/403/429、mime 异常）兜底截图裁剪。

并新增 `canvas-rebuild-fetch` 类型用于区分 canvas 场景的非截图成功路径。

### 3.3 Canvas 主路径接入（Phase B/C）

已落地 Main World hook + bridge 协议：

- `src/background/messages/inject-main-world-hook.ts` 负责 `world: "MAIN"` 注入。
- `src/contents/inject/canvas-image-hook.ts` hook：
    - `HTMLCanvasElement.getContext`
    - `CanvasRenderingContext2D.drawImage`
    - `OffscreenCanvas.getContext`
    - `OffscreenCanvasRenderingContext2D.drawImage`
- `src/contents/bridges/canvas-hook-bridge.ts` 维护 `CANVAS_META_*` 协议与查询缓存。
- `src/background/messages/canvas-hook-event.ts` 接收 Main World 错误上报。

### 3.4 防盗链规则体系工程化

- 引入源规则文件：`assets/request_modifier_rule.json`
- 引入同步脚本：`scripts/sync-hotlink-sites-from-immersive.js`
- 自动产物：`src/background/config/hotlink-sites.generated.ts`
- 手工规则/覆盖：`src/background/config/hotlink-sites.ts`
- DNR 执行层：`src/background/lib/hotlink-dnr.ts`

实现特征：

- 多候选排序（manual override > page-specific > priority > source > ruleKey）。
- 启动时清理动态规则区间（`900000-999999`）。
- 临时规则 try/finally 清理 + 80ms 生效等待。

---

## 4. 文件级关键实现

## 4.1 `package.json`

- `check` 增加 `check:hotlink-rules`。
- 新增脚本：
    - `sync:hotlink-rules`
    - `check:hotlink-rules`
- Manifest 权限新增：
    - `declarativeNetRequest`
    - `declarativeNetRequestWithHostAccess`

## 4.2 `src/background/messages/translate-image.ts`

核心变化：

1. 新增统一 background handler，替代旧 `download-image.ts`。
2. 实现抓图三层链路（direct → anti-hotlink → screenshot）。
3. 增加 `pageUrl`、`canvasMeta`、`requestId` 支持。
4. 增加 token 刷新（401 后刷新再重试一次）。
5. 增加图片 MIME 处理策略：
    - 仅 `png/jpeg` 原样透传。
    - `webp/avif/gif/bmp/...` 等 `image/*` 自动转 `png` 后上送。
6. 支持同站点自动候选 `auto-page-origin`（无规则命中时补一个弱候选 referer）。
7. 截图兜底支持：
    - UI 隐藏/恢复
    - `visualViewport` 偏移修正
    - 大图（超视口）提前失败，避免无效裁剪
    - img/canvas 目标双路径
8. 新增双备份返回通道（除主 `res.send` 外）：
    - `chrome.tabs.sendMessage`
    - `chrome.storage.local`

## 4.3 `src/services/imageTranslation.ts`

由旧的下载+上传本地处理，改为“薄封装 RPC 客户端”：

- 新函数：`translateImageViaBackground`
- 保留：`validateImage`（扩展到 `IMG/CANVAS`）
- 响应通道采用三路容错：
- WXT 扩展消息主通道
    - tabs message
    - storage 监听
- 包含请求超时控制（90s）与资源清理（listener、storage key）。

## 4.4 `src/contents/imageTranslate.tsx`

主要改造：

1. 交互对象从仅 `IMG` 扩展到 `IMG + CANVAS`。
2. 删除 `ImageLoadingOverlay`，统一由按钮 loading 状态承载。
3. 图片替换增强：
    - `src/srcset` 保护
    - 祖先 `background-image` 防回写保护
4. Canvas 展示方案：
    - 翻译结果作为 overlay 图层覆盖原 canvas
    - 再次点击可恢复原图
5. 注入桥接：
    - 页面激活时尝试 `ensureCanvasHookInjected`
    - 点击 canvas 时查询 `queryCanvasMeta`

## 4.5 `src/background/config/hotlink-sites.ts` & `*.generated.ts`

- 构建“手工规则 + 自动规则”合并模型。
- 新增 `pageHostAllowList`、`priority`、`override`。
- 当前手工规则已补 `shonenjumpplus`：
    - `cdn-ak-img.shonenjumpplus.com`
    - `referer=https://shonenjumpplus.com/`

## 4.6 `src/background/index.ts`

- 增加 `safeSendMessage`，统一吞掉无接收端场景的 `runtime.lastError`。
- 对 `TOGGLE_IMMERSIVE_TRANSLATE` 与 `GET_TRANSLATE_STATE` 回调也做了 `lastError` 判定。
- 作用：降低 `Receiving end does not exist` 噪音，避免污染排查信息。

## 4.7 `.env.development`

- 当前值切换为 dev 域名（`api-dev` / `dev.frontend`），生产域名被注释。
- 这会影响本地调试环境默认目标接口。

---

## 5. 与计划对齐情况

与 `docs/manga-sites-rollout-plan.md` 对照，已落地点包括：

1. Phase A：规则同步、多候选 anti-hotlink、check 脚本接入。
2. Phase B：Main World 注入、跨 world 协议、canvas 元数据查询与错误上报。
3. Phase C：站点灰度配置（`canvas-sites.ts`）、canvas overlay 用户体验、回滚开关支持。

---

## 6. 验证结果

本地执行结果：

1. `pnpm typecheck`：通过
2. `pnpm lint`：0 error（存在 12 条历史 warning）
3. `pnpm check`：通过（含 format/check:hotlink-rules/spell）

说明：当前阻塞性问题不是静态检查失败，而是站点运行时场景覆盖与规则命中精度。

---

## 7. 已知风险与观察点

1. `translate-image.ts`、`imageTranslate.tsx` 中调试日志较多，生产可观测建议统一到可控 logger。
2. DNR 规则按 host 级匹配，理论上同 host 并发请求存在临时规则重叠风险（已通过 rule-id 区间和清理机制减轻）。
3. 截图兜底仍受“单屏可见性”限制，大图场景会主动失败（设计如此，避免假成功）。
4. `.env.development` 当前指向 dev 接口，需确认是否符合团队默认预期。
5. `sendBackupResponse` 使用 storage 作为兜底通道，需持续观察 key 清理与异常路径残留概率。

---

## 8. 建议下一步

1. 在 `shonenjumpplus.com`、`comic-growl.com`、`championcross.jp` 各跑一轮实站回归，记录 `fetchPath` 分布。
2. 收敛调试日志并保留结构化关键字段（`site/fetchPath/failureType/errorCode/ruleHit/renderType`）。
3. 将站点级问题（如特定 CDN 域名）沉淀到 `hotlink-sites.ts` 手工覆盖规则，避免临时 patch 漂移。
4. 若稳定后准备合并，补充一份“运行手册”（如何从控制台快速判断当前命中路径和失败阶段）。
