# Token Usage Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 options 页面增加按日期、模型、功能与数据来源聚合的生成式 AI token 用量统计。

**Architecture:** 模型网关负责采集一次成功模型调用的 usage，独立统计模块负责规范化、估算、Zod 修复、30 天聚合和环境隔离持久化。options 页面只读取聚合结果并展示，不接触请求原文。

**Tech Stack:** TypeScript 5.8、React 18、styled-components、Chrome Storage、Zod 4、Vitest 4、xsAI 0.4.4

**Spec:** `docs/superpowers/specs/2026-09-07-token-usage-statistics.md`

## Global Constraints

- 不保存原文、译文、prompt、图片或 API Key。
- Google Translate、DeepL、DeepLX 不计入 token。
- 真实 usage 优先，缺失时本地估算，并标记来源。
- 统计异常不得影响翻译调用。
- 数据仅保留最近 30 个自然日。
- 修改 `src/` 后执行 `pnpm format`，完成后执行 `pnpm check` 并更新 `AGENTS.md`。

---

### Task 1: Token 统计领域模型与聚合存储

- [x] 先写并运行失败测试，覆盖估算、usage 规范化、字段修复、聚合、清理和清空。
- [x] 实现 `src/token-usage/types.ts`、`estimate.ts`、`storage.ts` 与环境隔离键。
- [x] 运行聚焦测试直至通过。

### Task 2: Model gateway usage collection

- [x] 先写并运行失败测试，覆盖真实 usage、估算兜底、维度记录与写入失败隔离。
- [x] 扩展协议并在 model gateway 与各功能调用点接入采集。
- [x] 运行 gateway 与 translation service 测试直至通过。

### Task 3: Options usage statistics page

- [x] 先写并运行失败测试，覆盖时间范围、明细、来源、空状态和清空。
- [x] 新增 options “用量统计”页面和导航。
- [x] 运行 jsdom UI 测试直至通过。

### Task 4: Project integration and verification

- [x] 将新增测试纳入 `test:image`。
- [x] 运行 `pnpm format`。
- [x] 运行 `pnpm check`。
- [x] 更新 `AGENTS.md` 修改记录并复验。
