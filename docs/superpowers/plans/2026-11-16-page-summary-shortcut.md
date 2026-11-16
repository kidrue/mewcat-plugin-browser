# 页面总结快捷键实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在设置页配置页面总结快捷键，并在网页直接打开现有总结弹窗。

**Architecture:** 复用现有快捷键编码与录制逻辑，将录制控件抽成通用组件。页面总结入口安装独立键盘监听，并调用现有 `PageSummaryController.start("manual")`，保留结果与任务复用。

**Tech Stack:** TypeScript、React、Jotai、Zod、Vitest，使用现有依赖。

**Spec:** `docs/superpowers/specs/2026-11-16-page-summary-shortcut-design.md`（已获用户确认）。

## Global Constraints

- 默认 `Alt+S`，持久化值 `Alt+KeyS`；空字符串表示禁用，旧配置补默认值。
- 自动总结关闭时快捷键仍可使用；扩展总开关关闭时不触发。
- 编辑、输入法及重复事件不触发；双向检测段落翻译快捷键冲突。
- 快捷键修改不得清除总结结果或重新发起自动请求。
- 不新增权限或依赖，不调用付费 API；保留工作区已有修改，不自动提交。
- 用户已经确认方案，以下实现与检查连续完成，不再征求常规步骤确认。

## Review Focus

- 检查 Shadow DOM 内编辑区域，以及编辑容器的后代元素。
- 检查配置变化后旧监听移除、清空后禁用和默认值迁移。
- 检查恢复默认操作也参与双向冲突检测。
- 检查加载中与已有结果的快捷打开不会重复请求。
- 检查被排除网站与正文不足时提示失败原因。

### Task 1: 配置与录制界面

**Files:** 新增 `src/components/ShortcutInput/index.tsx`，修改 `src/components/ParagraphShortcutInput/index.tsx`、`src/options/Basic.tsx`、`src/types/config.ts`、`src/types/extensionConfigSchema.ts`、`src/state/constants.ts`（以上路径相对于 `apps/extension`）。

**Interfaces:** 配置字段 `pageSummaryShortcut?: string`；通用组件接受独立的 ID、标签、默认值、可清除选项与冲突快捷键。

- [x] 在 `test/extension-config-validation.test.ts` 增加默认值、有效值、空值与无效值修复测试，在 `test/options-basic-page-summary.test.tsx` 增加录制、清空、恢复和双向冲突测试，先运行并确认失败。
- [x] 实现配置校验、默认值、通用组件和设置界面，使上述测试通过。

### Task 2: 页面键盘监听与弹窗

**Files:** 新增 `src/page-summary/pageSummaryShortcut.ts`，修改 `src/entrypoints/page-summary.content.tsx` 与 `test/page-summary-entrypoint.test.tsx`。

**Interfaces:** `DEFAULT_PAGE_SUMMARY_SHORTCUT = "Alt+KeyS"`；`installPageSummaryShortcut(shortcut: string, onOpen: () => void): () => void`。

- [x] 扩展入口测试覆盖快捷打开、任务复用、即时改键、总开关、空值禁用、编辑保护、输入法和重复事件、网站排除与清理监听；先确认失败。
- [x] 实现监听器并接入入口；失败结果使用现有 Toast 显示原因。
- [x] 运行相关配置、设置、段落快捷键、总结入口、手动总结和渲染测试，再执行 TypeScript、ESLint 与 `pnpm format`。
- [x] 审查最终差异，记录实际验证结果。

## 审查记录

- 独立只读审查已完成：除下述已修复的兼容性问题外，无其他已确认的重要问题，可交付。
- 设计补充：旧用户已将段落翻译配置为 `Alt+S` 时，新默认值将与之冲突。配置修复优先保留段落快捷键，并禁用冲突的总结快捷键；导入重复配置同样处理。代价是这些用户需要手动选择新的总结快捷键，设置中显示“已禁用”。已先添加两项回归测试，确认旧实现失败后修复。

## 验证记录

- 初次测试：3 个文件，16 项因缺少新功能而失败；实现后 71 项通过。
- 相关回归：9 个文件 149 项通过，包含升级/导入快捷键冲突的两项回归测试。
- `pnpm --filter @mewcat/extension typecheck`：通过。
- 修改的 8 个源文件 ESLint：0 错误；总结入口保留 2 项原有 `curly` 警告。
- 修改的源文件 CSpell：0 问题。
- 根目录 `pnpm format` 与 `git diff --check`：通过。
