# 划词完整译文与术语解释实施计划

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话执行，按测试、实现、验证顺序推进。

**Goal:** 划选长句、短句或单个术语后，同时展示完整译文和逐项概念解释。

**Architecture:** 沿用现有术语识别流式请求。有术语时同一次请求先返回完整译文，再返回术语解释；解析层分离两个字段，面板分别展示，复制时包含两个栏目。无术语时继续使用所选翻译服务。

**Tech Stack:** TypeScript、React、现有 Markdown 渲染器、Vitest。

**Spec:** 用户已确认本会话中的推荐方案；本文件记录该小改动的设计及执行步骤。

## Global Constraints

- 不新增依赖，不更改后端和共享协议。
- 保留无 AI、无术语及请求失败时的普通翻译和提示。
- 保留现有未提交改动；本任务不提交、不发布。
- 修改后执行 `pnpm format`、`pnpm check`、`pnpm build:verify`。

## 方案比较

- 已确认：单次 AI 请求同时生成译文和解释，减少请求次数与等待。
- 备选：分别请求翻译和解释，可以独立加载，但增加请求和状态复杂度。

## Review Focus

- 流式分片中不能显示或复制内部标记。
- 缺少译文或术语解释的响应必须降级，不能只留下解释。
- 多术语、长译文应正常换行并保持完整。
- 关闭面板或切换选区后，旧请求不得覆盖新结果。
- 复制内容包含译文和术语解释，普通翻译保持原文复制行为。

### Task 1: 请求、解析与面板联动

**Files:** `apps/extension/src/translation/{modelTranslation,selectionAnalysis}.ts`、`apps/extension/src/hooks/useSelectionTranslation.ts`、`apps/extension/src/components/{TranslateTextPanel,SelectionToolbar}/index.tsx`。

**Interfaces:** `SelectionAnalysis` 的 explain 分支与 `SelectionResult` 增加 `explanation` 字段，`value` 统一表示完整译文。

- [x] 补充解析分片、缺失栏目、多术语展示与复制测试；更新原解释模式测试数据。
- [x] 执行相关 Vitest，确认新用例因缺少功能而失败。
- [x] 提示词要求 `[EXPLAIN]`、`[TRANSLATION]`、`[TERMS]` 顺序输出；解析并缓冲分片标记，最终校验两个栏目非空。
- [x] Hook 发布译文与解释，面板显示“译文：”“术语解释：”，工具栏复制两项；沿用降级和取消逻辑。
- [x] 执行 `pnpm --filter @mewcat/extension test:selection`，预期全部通过。

### Task 2: 整体验证

- [x] 执行 `pnpm format`，检查 diff，保留用户既有改动。
- [x] 执行 `pnpm check` 和 `pnpm build:verify`，预期退出码为 0。
- [x] 检查代码差异及需求覆盖，报告验证结果和实际限制。


## 验证记录

- `pnpm format` 已执行；恢复无内容变化文件的原换行符，未引入无关格式差异。
- `pnpm --filter @mewcat/extension test:selection`：两项交互脚本通过，Vitest 104 项通过（59 + 45）。
- `pnpm check`：工作区、共享包、扩展及服务检查通过，最终日志为 `apps/extension check: Done`。
- `pnpm build:verify`：扩展和服务构建通过，Sentry 上传关闭。
- 独立代码审查发现重复控制标记可能进入结果，已补充失败用例、修复并通过回归测试。
- 未调用真实 AI API，未执行发布或 Git 提交。
