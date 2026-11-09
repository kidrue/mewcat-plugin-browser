# 段落补译 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. 用户已确认开始执行；不重复请求确认。

**Goal:** 使用最近 CSS 块级容器定位漏译区域，提供悬停预览与快捷键补译，并保留整页模式中的补译结果。

**Architecture:** 新增共享段落定位模块；手动提取用通用规则和明确的保护规则；整页观察器合并显式段落目标。

**Tech Stack:** TypeScript、DOM、WXT、Vitest/jsdom。

**Spec:** ../specs/2026-11-09-paragraph-recovery-design.md

## Global Constraints

- 不新增依赖，不修改其他未提交工作，不自动提交和升级版本。
- 测试不调用付费 API，执行 pnpm format、扩展 check 和 pnpm build:verify extension。

## Review Focus

- 实际 display 覆盖语义标签；display:contents 和 inline 标签不能提前截断。
- 代码命中禁止触发，代码后代不能随行内链接一起进入翻译输入。
- 嵌套容器、侧栏和被站点排除的短文本可手动补译，不扩大到整页。
- 高亮层不拦截页面事件，不触发观察器循环；快捷键动作与预览范围一致。
- 整页重扫、BR 分段、重复请求、仅译文模式、语言切换及目标卸载不丢失或重复补译。

### Task 1: 定位和手动提取

- [x] 在 paragraph-translation.test.ts 增加 CSS 边界、站点排除绕过、代码/编辑器保护测试；运行确认失败。
- [x] 新建 paragraphTarget.ts：resolveParagraphTarget(target: Element): HTMLElement | null；共享编辑器、扩展和代码保护选择器。
- [x] 修改 DomSelector 和 DOMTraverser，仅手动段落模式绕过站点过滤及祖先/侧栏启发式，保留通用文本与代码保护。
- [x] 运行 paragraph-translation、br-translation、github-dom-selection 测试。

### Task 2: 悬停高亮和快捷键

- [x] 在 paragraph-shortcut.test.ts 增加高亮范围、代码不触发、滚动/失焦/卸载移除和事件透传测试；运行确认失败。
- [x] 修改 paragraphShortcut.ts，复用定位模块，通过不接收鼠标事件的独立浮层显示边框和快捷键提示。
- [x] 更新 Basic.tsx 说明；运行快捷键及段落测试。

### Task 3: 补译生命周期与验收

- [x] 增加整页模式下站点遗漏段落补译、更新、移除及只译文恢复回归测试；运行确认失败。
- [x] 修改 ImmersiveTranslator 的观察提取与重启流程，将手动段落目标与整页节点合并去重。
- [x] 执行 pnpm format、扩展 check 和 pnpm build:verify extension，审查差异与浏览器交互验证。
- [x] 最终独立代码审查并处理阻塞问题，报告结果。

## 执行记录

- 已在原工作区完成，不修改其他既有工作，不自动提交。
- 定位、补译、快捷键、BR 与 GitHub 针对性测试：108 项通过。
- pnpm format、扩展完整 check、pnpm build:verify extension 均通过。
- 浏览器使用模拟翻译服务验证高亮范围、事件透传、手动补译、代码保护及相邻段落隔离，无付费 API 调用。
- 独立审查指出的块级代码保护、部分漏译重扫覆盖及代码快照更新均已补充回归并修复，复核无阻塞问题。
