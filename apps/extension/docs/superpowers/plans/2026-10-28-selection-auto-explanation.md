# 划词自动术语解释实施计划

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话逐项执行；需求已获确认。

**Goal:** 自动识别选区术语并直接简释，普通文本保留当前翻译服务，统一复制、固定、关闭工具栏。

**Architecture:** 复用 concept-explanation 流式请求，通过首行 `[EXPLAIN]` / `[TRANSLATE]` 决定结果路由。前端串行编排分析与翻译，AbortController 取消分析并隔离旧结果；标题工具栏通过面板结果快照复制当前完整内容。

**Tech Stack:** React 18、TypeScript、styled-components、Vitest、现有 model gateway。

**Spec:** ../specs/2026-10-28-selection-auto-explanation-design.md

## 全局约束

- 保持当前翻译服务选择及后台协议兼容，不新增依赖，不调用付费 API 验证。
- 普通词语不强行解释；术语解释使用目标语言与页面语境。
- 没有可用 AI 或分析失败时回退普通翻译并提示。
- 保留已有 popup 卡片样式修改；本轮不提交、推送或发布。

## 审查重点

- 首行标记跨流式分片、格式错误和空解释：不泄露协议标记，失败回退。
- 重选相同文字但语境或模型变化：取消旧分析，丢弃迟到结果。
- 关闭、卸载和旧普通翻译返回：不覆盖当前状态或继续发起回退请求。
- 流式中断：丢弃不完整解释，回退翻译一次，不自动重试循环。
- 复制期间切换内容：旧复制结果不得显示为新结果的成功状态。

## 任务 1：自动路由与面板

涉及 `src/translation/modelTranslation.ts`、新增 `src/translation/selectionAnalysis.ts`、替换旧手动解释 hook 为 `src/hooks/useSelectionTranslation.ts`、`src/components/TranslateTextPanel/index.tsx`。

- [x] 更新 `test/selection-explanation-panel.test.tsx`：自动解释不调用翻译，未命中才调用当前服务；覆盖取消、失败回退、无 AI、Markdown 安全和布局更新。运行观察失败。
- [x] 新增 `parseSelectionAnalysis(text: string, complete?: boolean)`：返回 explain / translate / pending，完整响应缺标记或空解释抛错。
- [x] `ConceptExplanationInput.detectTerms?: boolean` 开启术语检测提示词，继续复用现有流式请求和模型选择。
- [x] `useSelectionTranslation` 自动编排，结果含 mode、value、loading、notice、error、retry；面板以 `onResultChange` 同步快照，去掉解释按钮和底部复制按钮。
- [x] 定向 Vitest 通过；保留安全 Markdown、目标语言、服务选择回归。

## 任务 2：统一标题工具栏

新增 `src/components/SelectionToolbar/index.tsx`，修改 `src/contents/selectionTranslate.tsx`，新增 `test/selection-toolbar.test.tsx` 并加入 `test:selection`。

- [x] 先写复制完整结果、加载禁用、复制失败提示、固定切换、关闭、过期复制结果隔离测试并观察失败。
- [x] 标题右侧三个 30px 线性图标按钮，圆角、浅蓝 hover、蓝色固定态、复制成功勾、focus-visible、title 与 aria-label。
- [x] 面板标题随结果切换“划词翻译” / “概念解释”。
- [x] 工具栏测试和既有划词交互测试通过。

## 任务 3：验证与审查

- [x] `pnpm format`，显式格式化修改的测试与文档。
- [x] `pnpm --filter @mewcat/extension check`。
- [x] `pnpm build:verify extension`。
- [x] 一次独立只读审查，修复有效问题，清理仅换行造成的无关修改。

## 执行记录

- 已确认需求，直接在当前工作区执行，保留用户已有修改。

- 自动路由测试已观察 RED→GREEN；保留 Markdown 安全和流式取消回归。
- 工具栏测试已观察缺失组件失败→全部通过；复制、固定、关闭及过期反馈均有覆盖。
- `pnpm format`、`pnpm --filter @mewcat/extension check`、`pnpm build:verify extension` 均退出 0；定向新增/更新的三组测试共 59 项通过。
- 独立只读审查无 Critical / Important / Minor 问题；仅换行导致的无关修改已清理。
