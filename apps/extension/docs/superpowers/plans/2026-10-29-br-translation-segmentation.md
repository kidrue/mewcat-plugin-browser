# BR 翻译分段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将有效 BR 分隔的内容分别翻译，稳定展示和恢复。

**Architecture:** 在已有提取流程中保留 BR，再通过独立模块切分源节点并保存富文本片段。DomSelector 根据分段身份去重，ImmersiveTranslator 使用段尾锚点和块级展示。

**Tech Stack:** TypeScript、原生 DOM、Vitest/jsdom、WXT；Node.js 22.12+、pnpm 10.20.0。

**Spec:** `../specs/2026-10-29-br-translation-segmentation-design.md`

## Global Constraints

- 使用根目录唯一 pnpm-lock.yaml；不新增依赖，不调用付费 API。
- 原始 DOM 和事件保持完整，切换仅译文与清除后可恢复。
- 保留当前工作区既有修改；本次不提交或发布。
- 修改后执行 `pnpm format`、扩展 check 与 `pnpm build:verify extension`。

## Review Focus

- 同一父容器的重复行与文本包含关系不得误去重。
- 嵌套链接和强调标签中的 BR 不得丢失文字或原始事件。
- 连续、隐藏、段尾 BR 不产生空译文，代码区不被拆分。
- 仅译文模式动态重扫不产生重复请求或漂移的 ID。
- 动态删除/添加 BR 或更新同一文本节点后不残留过期译文。

### Task 1: 完整分段与渲染链路

**Files:**

- Create: `src/translation/lineBreakSegmentation.ts`
- Modify: `src/translation/DOMTraverser.ts`、`src/translation/DomSelector.ts`
- Modify as needed: `src/translation/ImmersiveTranslator.ts`、`src/translation/originalContent.ts`
- Create: `test/br-translation.test.ts`
- Modify: `package.json` 将测试纳入 test:reading

**Interfaces:**

- Consumes: 已有 `TranslationNode`、`TextNode`、过滤规则与原文隐藏机制。
- Produces: `splitTranslationNodeAtBreaks` 返回携带稳定分段标识、真实源节点及可选翻译片段的 `TranslationNode[]`；`insertTagType: "br"` 控制独占一行。

- [x] 添加提取和实际引擎回归测试，验证上述五类边界。
- [x] 运行新测试，确认因当前合并、锚点和去重行为失败。
- [x] 实现分段模块和提取/去重集成；保留原始节点，富文本克隆只用于生成翻译输入。
- [x] 验证新测试、paragraph、viewport、GitHub DOM 等相关测试全部通过。
- [x] 格式化并运行扩展完整检查、验证构建。
- [x] 独立审查本次变更，修复实际问题，记录最终证据。

## 执行记录

- 用户已明确授权执行确认方案，直接在本会话完成，不重复请求计划确认。
- Ruling: 继续当前工作区而不搬迁已有未提交功能；不创建提交，避免混入此前用户工作。
- Pre-flight: 单一任务覆盖提取、去重与渲染，共享接口为 TranslationNode；以既有源节点身份和恢复机制为约束。
- RED：首轮 12 项中 11 项按预期失败；追加仅保留内容、嵌套链接删除 BR 用例分别复现空占位符请求和旧译文混入。
- GREEN：最终 BR 16 项通过，与段落、viewport、GitHub 回归合计 96 项通过。
- `pnpm format`、`pnpm --filter @mewcat/extension check`、`pnpm build:verify extension` 均退出 0；完整检查包含本次 BR 测试。
- 独立审查发现的两项 Important 已修复并复核关闭，无剩余审查问题。
- Chrome 验证：读取用户链接的公开 DOM，正文含 44 个 BR；取实际首个多段 P 在本地加载真实引擎、模拟服务响应，提取 3 段、1 次模拟批请求、展示 3 个块级译文容器，前两段容器紧跟原始 BR，下一段原文位于译文下方。未调用真实翻译 API。截图工具未完成，以实际 DOM 与布局坐标验证展示顺序。
- Task 1: complete。验证包：`.output/mewCat-1.1.2-20261029 191040.zip`，未提交、推送或发布。
